/**
 * Travel Planning Service
 * Handles auto plan generation, trip persistence and cost recalculations
 */

import { storage } from "../storage";
import { db } from "../db";
import {
  containers,
  customers,
  serviceRequests,
  alerts,
  technicianTripTasks,
  technicianTrips,
  technicianTripCosts,
  type Technician,
  type TechnicianTripCost,
  type TechnicianTripTask,
} from "@shared/schema";
import { eq, and, or, isNull, ilike, inArray, sql, desc } from "drizzle-orm";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const OPEN_ALERT_STATUSES = ["open", "acknowledged"];
const COST_KEYS = ["travelFare", "stayCost", "dailyAllowance", "localTravelCost", "miscCost"] as const;

type CostKey = typeof COST_KEYS[number];
type CostField = { value: number; isManual: boolean };
type CostResponse = Record<CostKey, CostField> & { totalEstimatedCost: number; currency: string };

type TechnicianScore = {
  technician: Technician;
  score: number;
  reasons: string[];
  available: boolean;
};

type CityTaskCandidate = {
  containerId: string;
  siteName: string;
  customerId?: string | null;
  taskType: string;
  priority: string;
  scheduledDate: Date;
  estimatedDurationHours: number;
  serviceRequestId?: string | null;
  alertId?: string | null;
  notes?: string | null;
};

type AutoPlanInput = {
  destinationCity: string;
  startDate: string | Date;
  endDate: string | Date;
  technicianId?: string;
};

type SaveTripPayload = {
  technicianId: string;
  destinationCity: string;
  startDate: string | Date;
  endDate: string | Date;
  origin?: string;
  purpose?: string;
  notes?: string;
  currency?: string;
  costs?: Partial<Record<CostKey, CostField>>;
  tasks?: Array<{
    containerId: string;
    taskType: string;
    priority?: string;
    scheduledDate?: string | Date | null;
    estimatedDurationHours?: number | null;
    serviceRequestId?: string | null;
    alertId?: string | null;
    siteName?: string | null;
    customerId?: string | null;
    notes?: string | null;
    source?: string;
    isManual?: boolean;
  }>;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const extractBaseCity = (baseLocation: any): string => {
  if (!baseLocation) return "Unknown";
  if (typeof baseLocation === "string") return baseLocation;
  try {
    if (baseLocation.city) return baseLocation.city;
    if (baseLocation.town) return baseLocation.town;
    if (baseLocation.address) return baseLocation.address;
    if (baseLocation.label) return baseLocation.label;
    if (baseLocation.name) return baseLocation.name;
  } catch {
    // ignore parsing issues
  }
  return "Unknown";
};

/**
 * Extract service areas from technician's baseLocation and serviceAreas
 * Returns an array of location strings to search for containers
 */
const extractTechnicianServiceAreas = (technician: Technician): string[] => {
  const areas: string[] = [];
  
  // Extract from baseLocation
  const baseCity = extractBaseCity((technician as any).baseLocation || null);
  if (baseCity && baseCity !== "Unknown") {
    areas.push(baseCity);
    // Also try to extract city name if it's a full address
    const cityMatch = baseCity.match(/([^,]+)/);
    if (cityMatch && cityMatch[1] && cityMatch[1].trim() !== baseCity) {
      areas.push(cityMatch[1].trim());
    }
  }
  
  // Add serviceAreas if they exist
  if (technician.serviceAreas && Array.isArray(technician.serviceAreas)) {
    technician.serviceAreas.forEach(area => {
      if (area && typeof area === 'string' && area.trim()) {
        const trimmed = area.trim();
        if (!areas.includes(trimmed)) {
          areas.push(trimmed);
        }
      }
    });
  }
  
  return areas.filter(area => area && area !== "Unknown");
};

/**
 * Find containers/services/PMs in technician's service areas
 * Similar to collectCityTaskCandidates but searches across multiple areas
 */
const collectTechnicianAreaTaskCandidates = async (
  technician: Technician,
  startDate: Date,
  endDate: Date
): Promise<CityTaskCandidate[]> => {
  const serviceAreas = extractTechnicianServiceAreas(technician);
  
  if (serviceAreas.length === 0) {
    throw new Error("Technician has no service areas configured. Please set baseLocation or serviceAreas.");
  }
  
  // Build search patterns for all service areas
  const patterns = serviceAreas.map(area => `%${area.trim()}%`);
  
  // Find containers matching any of the service areas
  const containerRows = await db
    .select({
      id: containers.id,
      depot: containers.depot,
      containerCode: containers.containerCode,
      customerId: containers.currentCustomerId,
      customerName: customers.companyName,
    })
    .from(containers)
    .leftJoin(customers, eq(containers.currentCustomerId, customers.id))
    .where(
      or(
        ...patterns.map(pattern => ilike(containers.depot, pattern)),
        ...patterns.map(pattern => sql`${containers.currentLocation}::text ILIKE ${pattern}`),
        ...patterns.map(pattern => sql`${containers.excelMetadata}::text ILIKE ${pattern}`)
      )
    );

  if (!containerRows.length) {
    return [];
  }

  const containerIds = containerRows.map((row) => row.id);
  const selected = new Map<string, CityTaskCandidate>();

  const addCandidate = (candidate: CityTaskCandidate) => {
    if (!candidate.containerId || selected.has(candidate.containerId)) return;
    selected.set(candidate.containerId, candidate);
  };

  const PM_INTERVAL_DAYS = 180;
  const today = new Date();
  const lastServiceDates = new Map<string, Date>();

  // Get last service dates from completed service requests
  const completedRequests = await db
    .select({
      containerId: serviceRequests.containerId,
      completedAt: serviceRequests.actualEndTime,
    })
    .from(serviceRequests)
    .where(
      and(
        inArray(serviceRequests.containerId, containerIds),
        eq(serviceRequests.status, 'completed'),
        sql`${serviceRequests.actualEndTime} IS NOT NULL`
      )
    );

  completedRequests.forEach((request) => {
    if (!request.containerId || !request.completedAt) return;
    const completedAt = new Date(request.completedAt);
    const existing = lastServiceDates.get(request.containerId);
    if (!existing || completedAt > existing) {
      lastServiceDates.set(request.containerId, completedAt);
    }
  });

  // Get last service dates from service history
  try {
    const history = await db.execute(sql`
      SELECT container_number, MAX(complaint_attended_date) AS last_service_date
      FROM service_history
      WHERE container_number IN (${sql.join(containerRows.map((row) => sql`${row.containerCode}`), sql`, `)})
      GROUP BY container_number
    `);
    const codeToId = new Map(containerRows.map((row) => [row.containerCode, row.id]));
    const rows = Array.isArray(history) ? history : history.rows || [];
    rows.forEach((row: any) => {
      if (!row?.container_number || !row?.last_service_date) return;
      const containerId = codeToId.get(row.container_number);
      if (!containerId) return;
      const date = new Date(row.last_service_date);
      const existing = lastServiceDates.get(containerId);
      if (!existing || date > existing) {
        lastServiceDates.set(containerId, date);
      }
    });
  } catch {
    // ignore
  }

  // Check for PM due/overdue
  for (const container of containerRows) {
    const lastServiceDate = lastServiceDates.get(container.id);
    let needsPM = false;
    let pmReason = '';

    if (!lastServiceDate) {
      needsPM = true;
      pmReason = 'No service history found';
    } else {
      const nextDue = new Date(lastServiceDate);
      nextDue.setDate(nextDue.getDate() + PM_INTERVAL_DAYS);
      if (nextDue <= endDate && nextDue >= startDate) {
        needsPM = true;
        pmReason = `PM due ${nextDue.toISOString().split('T')[0]}`;
      } else if (nextDue < today) {
        needsPM = true;
        pmReason = `PM overdue since ${nextDue.toISOString().split('T')[0]}`;
      }
    }

    if (needsPM) {
      const areaName = container.depot || container.customerName || serviceAreas[0];
      addCandidate({
        containerId: container.id,
        siteName: container.customerName || container.depot || areaName,
        customerId: container.customerId,
        taskType: 'pm',
        priority: pmReason.includes('overdue') ? 'CRITICAL' : 'HIGH',
        scheduledDate: startDate,
        estimatedDurationHours: 2,
        notes: pmReason,
      });
    }
  }

  // Find containers with open alerts
  const alertsRows = await db
    .select({
      alert: alerts,
      container: containers,
      customerName: customers.companyName,
      customerId: customers.id,
    })
    .from(alerts)
    .innerJoin(containers, eq(alerts.containerId, containers.id))
    .leftJoin(customers, eq(containers.currentCustomerId, customers.id))
    .where(
      and(
        inArray(alerts.containerId, containerIds),
        isNull(alerts.resolvedAt)
      )
    );

  for (const row of alertsRows) {
    const containerId = row.container?.id;
    if (!containerId || selected.has(containerId)) continue;
    const areaName = row.container.depot || row.customerName || serviceAreas[0];
    addCandidate({
      containerId,
      siteName: row.customerName || row.container.depot || areaName,
      customerId: row.customerId,
      taskType: 'alert',
      priority: row.alert.severity === 'critical' ? 'CRITICAL' : row.alert.severity === 'high' ? 'HIGH' : 'MEDIUM',
      scheduledDate: startDate,
      estimatedDurationHours: row.alert.estimatedServiceTime ? Math.ceil(row.alert.estimatedServiceTime / 60) : 1,
      alertId: row.alert.id,
      notes: `Open alert: ${row.alert.title}`,
    });
  }

  // Find containers with pending service requests
  const pendingRequests = await db
    .select({
      serviceRequest: serviceRequests,
      container: containers,
      customerName: customers.companyName,
      customerId: customers.id,
    })
    .from(serviceRequests)
    .innerJoin(containers, eq(serviceRequests.containerId, containers.id))
    .leftJoin(customers, eq(containers.currentCustomerId, customers.id))
    .where(
      and(
        inArray(serviceRequests.containerId, containerIds),
        inArray(serviceRequests.status, ['pending', 'approved', 'scheduled'])
      )
    );

  for (const row of pendingRequests) {
    const containerId = row.container?.id;
    if (!containerId || selected.has(containerId)) continue;
    const areaName = row.container.depot || row.customerName || serviceAreas[0];
    addCandidate({
      containerId,
      siteName: row.customerName || row.container.depot || areaName,
      customerId: row.customerId,
      taskType: 'inspection',
      priority: row.serviceRequest.priority || 'MEDIUM',
      scheduledDate: row.serviceRequest.scheduledDate ? new Date(row.serviceRequest.scheduledDate) : startDate,
      estimatedDurationHours: row.serviceRequest.estimatedDuration ? Math.ceil(row.serviceRequest.estimatedDuration / 60) : 1,
      serviceRequestId: row.serviceRequest.id,
      notes: `Pending service request: ${row.serviceRequest.issueDescription?.substring(0, 100)}`,
    });
  }

  return Array.from(selected.values());
};

const normalizeDate = (value: string | Date, field: string): Date => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}`);
  }
  return date;
};

export const formatCostRecordForClient = (record?: TechnicianTripCost | null, currencyFallback = "INR"): CostResponse => {
  const toNumber = (input: any) => {
    if (input === null || input === undefined || input === "") return 0;
    const parsed = Number(input);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const result: Record<CostKey, CostField> = {
    travelFare: { value: toNumber(record?.travelFare), isManual: Boolean(record?.travelFareIsManual) },
    stayCost: { value: toNumber(record?.stayCost), isManual: Boolean(record?.stayCostIsManual) },
    dailyAllowance: { value: toNumber(record?.dailyAllowance), isManual: Boolean(record?.dailyAllowanceIsManual) },
    localTravelCost: { value: toNumber(record?.localTravelCost), isManual: Boolean(record?.localTravelCostIsManual) },
    miscCost: { value: toNumber(record?.miscCost), isManual: Boolean(record?.miscCostIsManual) },
  };

  const total = toNumber(
    record?.totalEstimatedCost ||
      result.travelFare.value +
        result.stayCost.value +
        result.dailyAllowance.value +
        result.localTravelCost.value +
        result.miscCost.value
  );

  return {
    ...result,
    totalEstimatedCost: roundCurrency(total),
    currency: record?.currency || currencyFallback,
  };
};

const buildCostInput = (input?: Partial<Record<CostKey, CostField>>) => {
  const normalized: Record<CostKey, CostField> = {
    travelFare: { value: 0, isManual: false },
    stayCost: { value: 0, isManual: false },
    dailyAllowance: { value: 0, isManual: false },
    localTravelCost: { value: 0, isManual: false },
    miscCost: { value: 0, isManual: false },
  };

  if (input) {
    COST_KEYS.forEach((key) => {
      if (input[key]) {
        const value = Number(input[key]?.value ?? 0);
        normalized[key] = {
          value: Number.isNaN(value) ? 0 : roundCurrency(value),
          isManual: Boolean(input[key]?.isManual),
        };
      }
    });
  }

  return normalized;
};

/**
 * Calculate cost estimates for a trip
 * Returns cost breakdown including travelFare, stayCost, dailyAllowance, miscellaneous, and totalCost
 */
export const calculateCostEstimates = async (
  technician: Technician,
  destinationCity: string,
  startDate: Date,
  endDate: Date
) => {
  const multiplier = await storage.getLocationMultiplier(destinationCity).catch(() => 1);
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_IN_MS) + 1);
  const nights = Math.max(1, days - 1);

  // Use technician allowances, defaulting to 0 if not provided
  const hotelAllowance = Number(technician.hotelAllowance || 0);
  const personalAllowance = Number(technician.personalAllowance || 0);
  const localTravelAllowance = Number(technician.localTravelAllowance || 0);

  // Calculate costs according to requirements
  // travelFare = estimated default constant (₹1000) if no distance method exists
  const travelFare = 1000; // Default constant
  
  // stayCost = technician.hotelAllowance * numberOfDays (using nights, no multiplier)
  const stayCost = roundCurrency(nights * hotelAllowance);
  
  // dailyAllowance = technician.personalAllowance * numberOfDays (no multiplier)
  const dailyAllowance = roundCurrency(days * personalAllowance);
  
  // localTravelCost = technician.localTravelAllowance * numberOfDays (with multiplier for location)
  const localTravelCost = roundCurrency(days * localTravelAllowance * multiplier);
  
  // miscellaneous = 0 for now (as per requirements)
  const miscellaneous = 0;

  const totalCost = travelFare + stayCost + dailyAllowance + localTravelCost + miscellaneous;

  // Return in the format expected by the API
  return {
    travelFare: roundCurrency(travelFare),
    stayCost: roundCurrency(stayCost),
    dailyAllowance: roundCurrency(dailyAllowance),
    localTravelCost: roundCurrency(localTravelCost),
    miscellaneous: roundCurrency(miscellaneous),
    totalCost: roundCurrency(totalCost),
    // Also return in the old format for backward compatibility
    breakdown: {
      travelFare: { value: travelFare, isManual: false },
      stayCost: { value: stayCost, isManual: false },
      dailyAllowance: { value: dailyAllowance, isManual: false },
      localTravelCost: { value: localTravelCost, isManual: false },
      miscCost: { value: miscellaneous, isManual: false },
    },
    totalEstimatedCost: roundCurrency(totalCost),
    currency: "INR",
    multiplier,
    days,
    nights,
  };
};

const technicianHasOverlap = async (technicianId: string, start: Date, end: Date): Promise<boolean> => {
  const overlaps = await db
    .select({ id: technicianTrips.id })
    .from(technicianTrips)
    .where(
      and(
        eq(technicianTrips.technicianId, technicianId),
        sql`${technicianTrips.tripStatus} != 'cancelled'`,
        sql`${technicianTrips.startDate} <= ${end}`,
        sql`${technicianTrips.endDate} >= ${start}`
      )
    )
    .limit(1);

  return overlaps.length > 0;
};

const scoreTechnician = async (technician: Technician, destinationCity: string, start: Date, end: Date): Promise<TechnicianScore> => {
  const reasons: string[] = [];
  let score = 0;
  const baseCity = extractBaseCity((technician as any).baseLocation || null);
  const normalizedDestination = destinationCity.trim().toLowerCase();
  const normalizedBase = baseCity.trim().toLowerCase();

  if (normalizedBase && normalizedDestination.includes(normalizedBase)) {
    score += 60;
    reasons.push("Base location matches destination");
  } else if (normalizedBase && normalizedDestination && normalizedBase.split(",").some((segment) => normalizedDestination.includes(segment.trim()))) {
    score += 30;
    reasons.push("Destination near base location");
  }

  const hasOverlap = await technicianHasOverlap(technician.id, start, end);
  if (!hasOverlap) {
    score += 25;
    reasons.push("No overlapping trips");
  } else {
    reasons.push("Overlapping trip in window");
  }

  if (technician.skills?.length) {
    score += Math.min(technician.skills.length * 2, 15);
    reasons.push("Skill coverage");
  }

  if (technician.averageRating) {
    score += Math.min(Number(technician.averageRating) * 2, 10);
    reasons.push("Strong performance rating");
  }

  const available = !hasOverlap && (technician.status || "").toLowerCase() !== "off_duty";

  return { technician, score, reasons, available };
};

const collectCityTaskCandidates = async (destinationCity: string, startDate: Date, endDate: Date): Promise<CityTaskCandidate[]> => {
  try {
    const trimmedCity = destinationCity.trim();
    if (!trimmedCity) return [];

    const pattern = `%${trimmedCity}%`;

    const containerRows = await db
      .select({
        id: containers.id,
        depot: containers.depot,
        containerCode: containers.containerCode,
        customerId: containers.currentCustomerId,
        customerName: customers.companyName,
        createdAt: containers.createdAt,
      })
      .from(containers)
      .leftJoin(customers, eq(containers.currentCustomerId, customers.id))
      .where(
        or(
          ilike(containers.depot, pattern),
          sql`${containers.currentLocation}::text ILIKE ${pattern}`,
          sql`${containers.excelMetadata}::text ILIKE ${pattern}`
        )
      )
      .limit(1000); // Limit to prevent huge queries

    if (!containerRows.length) {
      console.log(`[Travel Planning] No containers found for city: ${trimmedCity}`);
      return [];
    }

  const containerIds = containerRows.map((row) => row.id);
  const selected = new Map<string, CityTaskCandidate>();

  const addCandidate = (candidate: CityTaskCandidate) => {
    if (!candidate.containerId || selected.has(candidate.containerId)) return;
    selected.set(candidate.containerId, candidate);
  };

  // PM system integration: Use 90-day threshold (3 months)
  const PM_THRESHOLD_DAYS = 90;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Compute last PM date from service_requests table
  // Get MAX(actualEndTime) for completed PM service requests
  const lastPmDateMap = new Map<string, Date>();
  
  try {
    if (containerIds.length > 0) {
      const completedPMRequests = await db
        .select({
          containerId: serviceRequests.containerId,
          actualEndTime: serviceRequests.actualEndTime,
        })
        .from(serviceRequests)
        .where(
          and(
            inArray(serviceRequests.containerId, containerIds),
            or(
              ilike(serviceRequests.issueDescription, '%Preventive Maintenance%'),
              ilike(serviceRequests.issueDescription, '%PM%'),
              ilike(serviceRequests.workType, '%PM%')
            ),
            inArray(serviceRequests.status, ['completed']),
            sql`${serviceRequests.actualEndTime} IS NOT NULL`
          )
        )
        .limit(10000); // Safety limit

      // Group by containerId and get the most recent PM date (MAX)
      completedPMRequests.forEach((req: any) => {
        if (req.containerId && req.actualEndTime) {
          try {
            const existing = lastPmDateMap.get(req.containerId);
            const currentDate = new Date(req.actualEndTime);
            if (!existing || currentDate > existing) {
              lastPmDateMap.set(req.containerId, currentDate);
            }
          } catch (dateError) {
            console.warn(`[Travel Planning] Invalid date for container ${req.containerId}:`, req.actualEndTime);
          }
        }
      });
    }
  } catch (pmDateError: any) {
    console.error('[Travel Planning] Error computing last PM dates:', pmDateError);
    // Continue with empty map - containers without PM history will use createdAt fallback
  }
  
  // First, check for PM-due containers using computed last PM dates
  const pmDueContainers: Array<{ containerId: string; daysSinceLastPM: number; priority: string }> = [];
  
  for (const container of containerRows) {
    let needsPM = false;
    let daysSinceLastPM = 0;
    let priority = 'HIGH';
    
    // Get computed last PM date from service history
    const computedLastPmDate = lastPmDateMap.get(container.id);
    
    if (computedLastPmDate) {
      // Use computed last PM date
      const lastPmDate = new Date(computedLastPmDate);
      lastPmDate.setHours(0, 0, 0, 0);
      daysSinceLastPM = Math.floor((today.getTime() - lastPmDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastPM >= PM_THRESHOLD_DAYS) {
        needsPM = true;
        priority = daysSinceLastPM > PM_THRESHOLD_DAYS + 30 ? 'CRITICAL' : 'HIGH';
      }
    } else if (container.createdAt) {
      // If no PM history, check if container is old enough (created > 90 days ago)
      const createdDate = new Date(container.createdAt);
      daysSinceLastPM = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastPM >= PM_THRESHOLD_DAYS) {
        needsPM = true;
        priority = 'HIGH';
      }
    }
    
    // Also check for existing PM service requests (pending/scheduled)
    if (needsPM) {
      const existingPMRequest = await db
        .select({ id: serviceRequests.id })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.containerId, container.id),
            or(
              ilike(serviceRequests.issueDescription, '%Preventive Maintenance%'),
              ilike(serviceRequests.issueDescription, '%PM%')
            ),
            inArray(serviceRequests.status, ['pending', 'approved', 'scheduled']),
            sql`${serviceRequests.actualEndTime} IS NULL`
          )
        )
        .limit(1);
      
      // Only add if no existing PM request
      if (existingPMRequest.length === 0) {
        pmDueContainers.push({
          containerId: container.id,
          daysSinceLastPM,
          priority,
        });
      }
    }
  }
  
  // Add PM-due containers FIRST (top priority)
  for (const pmContainer of pmDueContainers) {
    const container = containerRows.find(c => c.id === pmContainer.containerId);
    if (!container) continue;
    
    const areaName = container.depot || container.customerName || trimmedCity;
    addCandidate({
      containerId: container.id,
      siteName: container.customerName || container.depot || areaName,
      customerId: container.customerId,
      taskType: 'pm',
      priority: pmContainer.priority,
      scheduledDate: startDate,
      estimatedDurationHours: 2,
      notes: `Preventive Maintenance - ${pmContainer.daysSinceLastPM} days since last PM (90-day threshold)`,
    });
  }
  
  // Fallback: Check service history for containers without PM system data
  const lastServiceDates = new Map<string, Date>();
  const completedRequests = await db
    .select({
      containerId: serviceRequests.containerId,
      completedAt: serviceRequests.actualEndTime,
    })
    .from(serviceRequests)
    .where(
      and(
        inArray(serviceRequests.containerId, containerIds),
        eq(serviceRequests.status, 'completed'),
        sql`${serviceRequests.actualEndTime} IS NOT NULL`
      )
    );

  completedRequests.forEach((request) => {
    if (!request.containerId || !request.completedAt) return;
    const completedAt = new Date(request.completedAt);
    const existing = lastServiceDates.get(request.containerId);
    if (!existing || completedAt > existing) {
      lastServiceDates.set(request.containerId, completedAt);
    }
  });

  try {
    const history = await db.execute(sql`
      SELECT container_number, MAX(complaint_attended_date) AS last_service_date
      FROM service_history
      WHERE container_number IN (${sql.join(containerRows.map((row) => sql`${row.containerCode}`), sql`, `)})
      GROUP BY container_number
    `);
    const codeToId = new Map(containerRows.map((row) => [row.containerCode, row.id]));
    const rows = Array.isArray(history) ? history : history.rows || [];
    rows.forEach((row: any) => {
      if (!row?.container_number || !row?.last_service_date) return;
      const containerId = codeToId.get(row.container_number);
      if (!containerId) return;
      const date = new Date(row.last_service_date);
      const existing = lastServiceDates.get(containerId);
      if (!existing || date > existing) {
        lastServiceDates.set(containerId, date);
      }
    });
  } catch {
    // ignore
  }

  // Check remaining containers (not already in PM list) for service history-based PM
  for (const container of containerRows) {
    // Skip if already added as PM-due
    if (pmDueContainers.some(pm => pm.containerId === container.id)) continue;
    
    const lastServiceDate = lastServiceDates.get(container.id);
    let needsPM = false;
    let pmReason = '';

    if (!lastServiceDate) {
      // No service history - might need PM
      needsPM = true;
      pmReason = 'No service history found';
    } else {
      const nextDue = new Date(lastServiceDate);
      nextDue.setDate(nextDue.getDate() + PM_THRESHOLD_DAYS);
      if (nextDue <= endDate && nextDue >= startDate) {
        needsPM = true;
        pmReason = `PM due ${nextDue.toISOString().split('T')[0]}`;
      } else if (nextDue < today) {
        needsPM = true;
        pmReason = `PM overdue since ${nextDue.toISOString().split('T')[0]}`;
      }
    }

    if (needsPM) {
      const areaName = container.depot || container.customerName || trimmedCity;
      addCandidate({
        containerId: container.id,
        siteName: container.customerName || container.depot || areaName,
        customerId: container.customerId,
        taskType: 'pm',
        priority: pmReason.includes('overdue') ? 'CRITICAL' : 'HIGH',
        scheduledDate: startDate,
        estimatedDurationHours: 2,
        notes: pmReason,
      });
    }
  }

  const alertsRows = await db
    .select({
      alert: alerts,
      container: containers,
      customerName: customers.companyName,
      customerId: customers.id,
    })
    .from(alerts)
    .innerJoin(containers, eq(alerts.containerId, containers.id))
    .leftJoin(customers, eq(containers.currentCustomerId, customers.id))
    .where(
      and(
        inArray(alerts.containerId, containerIds),
        isNull(alerts.resolvedAt)
      )
    );

  for (const row of alertsRows) {
    const containerId = row.container?.id;
    if (!containerId || selected.has(containerId)) continue;
    addCandidate({
      containerId,
      siteName: row.customerName || row.container.depot || trimmedCity,
      customerId: row.customerId,
      taskType: 'alert',
      priority: row.alert.severity === 'critical' ? 'CRITICAL' : row.alert.severity === 'high' ? 'HIGH' : 'MEDIUM',
      scheduledDate: startDate,
      estimatedDurationHours: row.alert.estimatedServiceTime ? Math.ceil(row.alert.estimatedServiceTime / 60) : 1,
      alertId: row.alert.id,
      notes: `Open alert: ${row.alert.title}`,
    });
  }

  const pendingRequests = await db
    .select({
      serviceRequest: serviceRequests,
      container: containers,
      customerName: customers.companyName,
      customerId: customers.id,
    })
    .from(serviceRequests)
    .innerJoin(containers, eq(serviceRequests.containerId, containers.id))
    .leftJoin(customers, eq(containers.currentCustomerId, customers.id))
    .where(
      and(
        inArray(serviceRequests.containerId, containerIds),
        inArray(serviceRequests.status, ['pending', 'approved', 'scheduled'])
      )
    );

  for (const row of pendingRequests) {
    const containerId = row.container?.id;
    if (!containerId || selected.has(containerId)) continue;
    addCandidate({
      containerId,
      siteName: row.customerName || row.container.depot || trimmedCity,
      customerId: row.customerId,
      taskType: 'inspection',
      priority: row.serviceRequest.priority || 'MEDIUM',
      scheduledDate: row.serviceRequest.scheduledDate ? new Date(row.serviceRequest.scheduledDate) : startDate,
      estimatedDurationHours: row.serviceRequest.estimatedDuration ? Math.ceil(row.serviceRequest.estimatedDuration / 60) : 1,
      serviceRequestId: row.serviceRequest.id,
      notes: `Pending service request: ${row.serviceRequest.issueDescription?.substring(0, 100)}`,
    });
  }

    return Array.from(selected.values());
  } catch (error: any) {
    console.error('[Travel Planning] Error in collectCityTaskCandidates:', error);
    console.error('[Travel Planning] Error details:', {
      destinationCity,
      startDate,
      endDate,
      message: error?.message,
      stack: error?.stack,
    });
    // Return empty array on error rather than crashing
    return [];
  }
}

// Export for use in routes
export { collectCityTaskCandidates };

export async function generateTripTasksForDestination(tripId: string): Promise<TechnicianTripTask[]> {
  const trip = await storage.getTechnicianTrip(tripId);
  if (!trip) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  const existingTasks = await storage.getTechnicianTripTasks(tripId);
  const existingContainers = new Set(existingTasks.map((task) => task.containerId));

  const candidates = await collectCityTaskCandidates(trip.destinationCity, startDate, endDate);
  
  // Separate PM tasks from other tasks and prioritize PM
  const pmTasks = candidates.filter(c => c.taskType === 'pm');
  const otherTasks = candidates.filter(c => c.taskType !== 'pm');
  
  // Sort PM tasks by priority (CRITICAL first, then HIGH)
  pmTasks.sort((a, b) => {
    const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    return (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - 
           (priorityOrder[b.priority as keyof typeof priorityOrder] || 99);
  });
  
  // Combine: PM tasks first, then other tasks
  const prioritizedCandidates = [...pmTasks, ...otherTasks];
  
  // Distribute tasks across days (max 3 per day)
  const tasksByDate = new Map<string, CityTaskCandidate[]>();
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_IN_MS);
  let currentDate = new Date(startDate);
  let taskIndex = 0;
  
  for (let day = 0; day <= daysDiff && taskIndex < prioritizedCandidates.length; day++) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const dayTasks: CityTaskCandidate[] = [];
    
    // Add up to 3 tasks per day, prioritizing PM tasks
    for (let i = 0; i < 3 && taskIndex < prioritizedCandidates.length; i++) {
      const candidate = prioritizedCandidates[taskIndex];
      candidate.scheduledDate = new Date(currentDate);
      dayTasks.push(candidate);
      taskIndex++;
    }
    
    if (dayTasks.length > 0) {
      tasksByDate.set(dateKey, dayTasks);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const created: TechnicianTripTask[] = [];

  // Create tasks in priority order (PM first)
  for (const candidate of prioritizedCandidates) {
    if (existingContainers.has(candidate.containerId)) continue;
    const task = await storage.createTechnicianTripTask({
      tripId,
      containerId: candidate.containerId,
      siteName: candidate.siteName,
      customerId: candidate.customerId,
      taskType: candidate.taskType,
      priority: candidate.priority,
      scheduledDate: candidate.scheduledDate,
      estimatedDurationHours: candidate.estimatedDurationHours,
      status: 'pending',
      serviceRequestId: candidate.serviceRequestId,
      alertId: candidate.alertId,
      notes: candidate.notes,
      source: 'auto',
      isManual: false,
    });
    existingContainers.add(candidate.containerId);
    created.push(task);
  }

  return created;
}

export async function autoPlanTravel(params: AutoPlanInput) {
  const { destinationCity, technicianId } = params;
  if (!destinationCity) throw new Error("destinationCity is required");
  if (!params.startDate || !params.endDate) throw new Error("startDate and endDate are required");

  const startDate = normalizeDate(params.startDate, "startDate");
  const endDate = normalizeDate(params.endDate, "endDate");
  if (endDate < startDate) throw new Error("endDate must be after startDate");

  const technicians = await storage.getAllTechnicians();
  if (!technicians.length) throw new Error("No technicians available");

  const scored: TechnicianScore[] = [];
  for (const tech of technicians) {
    scored.push(await scoreTechnician(tech, destinationCity, startDate, endDate));
  }

  const available = scored.filter((entry) => entry.available);
  let selected = technicianId
    ? available.find((entry) => entry.technician.id === technicianId)
    : available.sort((a, b) => b.score - a.score)[0];

  if (!selected && technicianId) {
    selected = scored.find((entry) => entry.technician.id === technicianId);
  }
  if (!selected) {
    throw new Error("No available technician for the selected window");
  }

  const technicianUser = selected.technician.userId
    ? await storage.getUser(selected.technician.userId).catch(() => null)
    : null;

  const costEstimates = await calculateCostEstimates(selected.technician, destinationCity, startDate, endDate);
  const tasks = await collectCityTaskCandidates(destinationCity, startDate, endDate);
  
  // Prioritize PM tasks: separate and sort
  const pmTasks = tasks.filter(t => t.taskType === 'pm');
  const otherTasks = tasks.filter(t => t.taskType !== 'pm');
  
  // Sort PM tasks by priority (CRITICAL first, then HIGH)
  pmTasks.sort((a, b) => {
    const priorityOrder: Record<string, number> = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
  });
  
  // Distribute tasks across days (max 3 per day), PM tasks first
  const allTasks = [...pmTasks, ...otherTasks];
  const tasksByDate = new Map<string, typeof allTasks>();
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_IN_MS);
  let currentDate = new Date(startDate);
  let taskIndex = 0;
  
  for (let day = 0; day <= daysDiff && taskIndex < allTasks.length; day++) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const dayTasks: typeof allTasks = [];
    
    // Add up to 3 tasks per day
    for (let i = 0; i < 3 && taskIndex < allTasks.length; i++) {
      const task = allTasks[taskIndex];
      task.scheduledDate = new Date(currentDate);
      dayTasks.push(task);
      taskIndex++;
    }
    
    if (dayTasks.length > 0) {
      tasksByDate.set(dateKey, dayTasks);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const formattedTasks = allTasks.map((task) => ({
    containerId: task.containerId,
    siteName: task.siteName,
    customerId: task.customerId,
    taskType: task.taskType,
    priority: task.priority,
    scheduledDate: task.scheduledDate.toISOString(),
    estimatedDurationHours: task.estimatedDurationHours,
    serviceRequestId: task.serviceRequestId,
    alertId: task.alertId,
    notes: task.notes,
    source: "auto",
    isManual: false,
  }));

  const suggestions = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => ({
      id: entry.technician.id,
      name: (entry.technician as any).name || entry.technician.employeeCode,
      score: entry.score,
      available: entry.available,
      reasons: entry.reasons,
    }));

  return {
    success: true,
    technician: {
      id: selected.technician.id,
      name: (selected.technician as any).name || technicianUser?.name || selected.technician.employeeCode,
      grade: selected.technician.grade,
      baseLocation: extractBaseCity((selected.technician as any).baseLocation || null),
    },
    technicianSuggestions: suggestions,
    technicianSourceCity: extractBaseCity((selected.technician as any).baseLocation || null),
    travelWindow: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days: costEstimates.days,
      nights: costEstimates.nights,
    },
    costs: formatCostRecordForClient({
      tripId: "",
      travelFare: costEstimates.breakdown.travelFare.value.toString(),
      travelFareIsManual: costEstimates.breakdown.travelFare.isManual,
      stayCost: costEstimates.breakdown.stayCost.value.toString(),
      stayCostIsManual: costEstimates.breakdown.stayCost.isManual,
      dailyAllowance: costEstimates.breakdown.dailyAllowance.value.toString(),
      dailyAllowanceIsManual: costEstimates.breakdown.dailyAllowance.isManual,
      localTravelCost: costEstimates.breakdown.localTravelCost.value.toString(),
      localTravelCostIsManual: costEstimates.breakdown.localTravelCost.isManual,
      miscCost: costEstimates.breakdown.miscCost.value.toString(),
      miscCostIsManual: costEstimates.breakdown.miscCost.isManual,
      totalEstimatedCost: costEstimates.totalEstimatedCost.toString(),
      currency: costEstimates.currency,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as TechnicianTripCost),
    tasks: formattedTasks,
    metadata: {
      multiplier: costEstimates.multiplier,
      autoPlanVersion: "v2",
    },
  };
}

/**
 * Auto-plan travel based on technician's location/service areas
 * Finds services/PMs in technician's area and creates a travel plan
 */
export async function autoPlanTravelByTechnician(params: {
  technicianId: string;
  startDate: string | Date;
  endDate: string | Date;
  destinationCity?: string; // Optional override, otherwise uses technician's primary service area
}) {
  const { technicianId } = params;
  if (!technicianId) throw new Error("technicianId is required");
  if (!params.startDate || !params.endDate) throw new Error("startDate and endDate are required");

  const startDate = normalizeDate(params.startDate, "startDate");
  const endDate = normalizeDate(params.endDate, "endDate");
  if (endDate < startDate) throw new Error("endDate must be after startDate");

  // Get technician
  const technician = await storage.getTechnician(technicianId);
  if (!technician) {
    throw new Error("Technician not found");
  }

  // Check for overlapping trips
  const hasOverlap = await technicianHasOverlap(technicianId, startDate, endDate);
  if (hasOverlap) {
    throw new Error("Technician has overlapping trips in the selected window");
  }

  // Get technician's service areas
  const serviceAreas = extractTechnicianServiceAreas(technician);
  if (serviceAreas.length === 0) {
    throw new Error("Technician has no service areas configured. Please set baseLocation or serviceAreas.");
  }

  // Use provided destinationCity or primary service area
  const destinationCity = params.destinationCity?.trim() || serviceAreas[0];

  // Find tasks in technician's service areas
  const tasks = await collectTechnicianAreaTaskCandidates(technician, startDate, endDate);

  if (tasks.length === 0) {
    throw new Error(`No services, PMs, or alerts found in technician's service areas: ${serviceAreas.join(", ")}`);
  }

  // Calculate cost estimates
  const costEstimates = await calculateCostEstimates(technician, destinationCity, startDate, endDate);

  // Get technician user info
  const technicianUser = technician.userId
    ? await storage.getUser(technician.userId).catch(() => null)
    : null;

  const formattedTasks = tasks.map((task) => ({
    containerId: task.containerId,
    siteName: task.siteName,
    customerId: task.customerId,
    taskType: task.taskType,
    priority: task.priority,
    scheduledDate: task.scheduledDate.toISOString(),
    estimatedDurationHours: task.estimatedDurationHours,
    serviceRequestId: task.serviceRequestId,
    alertId: task.alertId,
    notes: task.notes,
    source: "auto",
    isManual: false,
  }));

  return {
    success: true,
    technician: {
      id: technician.id,
      name: (technician as any).name || technicianUser?.name || technician.employeeCode,
      grade: technician.grade,
      baseLocation: extractBaseCity((technician as any).baseLocation || null),
      serviceAreas: serviceAreas,
    },
    destinationCity: destinationCity,
    technicianSourceCity: extractBaseCity((technician as any).baseLocation || null),
    travelWindow: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days: costEstimates.days,
      nights: costEstimates.nights,
    },
    costs: formatCostRecordForClient({
      tripId: "",
      travelFare: costEstimates.breakdown.travelFare.value.toString(),
      travelFareIsManual: costEstimates.breakdown.travelFare.isManual,
      stayCost: costEstimates.breakdown.stayCost.value.toString(),
      stayCostIsManual: costEstimates.breakdown.stayCost.isManual,
      dailyAllowance: costEstimates.breakdown.dailyAllowance.value.toString(),
      dailyAllowanceIsManual: costEstimates.breakdown.dailyAllowance.isManual,
      localTravelCost: costEstimates.breakdown.localTravelCost.value.toString(),
      localTravelCostIsManual: costEstimates.breakdown.localTravelCost.isManual,
      miscCost: costEstimates.breakdown.miscCost.value.toString(),
      miscCostIsManual: costEstimates.breakdown.miscCost.isManual,
      totalEstimatedCost: costEstimates.totalEstimatedCost.toString(),
      currency: costEstimates.currency,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as TechnicianTripCost),
    tasks: formattedTasks,
    metadata: {
      multiplier: costEstimates.multiplier,
      autoPlanVersion: "v3-technician-based",
      serviceAreas: serviceAreas,
    },
  };
}

export async function savePlannedTrip(payload: SaveTripPayload, userId?: string) {
  const startDate = normalizeDate(payload.startDate, "startDate");
  const endDate = normalizeDate(payload.endDate, "endDate");
  if (endDate < startDate) throw new Error("endDate must be after startDate");

  const technician = await storage.getTechnician(payload.technicianId);
  if (!technician) {
    const err = new Error("Technician not found");
    (err as any).statusCode = 404;
    throw err;
  }

  const origin = payload.origin?.trim() || extractBaseCity((technician as any).baseLocation || null);
  const destinationCity = payload.destinationCity.trim();
  if (!destinationCity) throw new Error("destinationCity is required");

  const costInput = buildCostInput(payload.costs);
  const totalEstimatedCost =
    costInput.travelFare.value +
    costInput.stayCost.value +
    costInput.dailyAllowance.value +
    costInput.localTravelCost.value +
    costInput.miscCost.value;

  const currency = payload.currency || "INR";

  const taskMap = new Map<string, SaveTripPayload["tasks"][number]>();
  (payload.tasks || []).forEach((task) => {
    if (!task?.containerId) return;
    const key = String(task.containerId);
    const existing = taskMap.get(key);
    if (!existing || (task.isManual && !existing.isManual)) {
      taskMap.set(key, task);
    }
  });

  const taskRows = Array.from(taskMap.values()).map((task) => ({
    containerId: String(task!.containerId),
    siteName: task?.siteName || null,
    customerId: task?.customerId || null,
    taskType: (task?.taskType || 'pm').toLowerCase(),
    priority: task?.priority || 'normal',
    scheduledDate: task?.scheduledDate ? new Date(task.scheduledDate) : startDate,
    estimatedDurationHours: task?.estimatedDurationHours ?? 2,
    status: 'pending',
    serviceRequestId: task?.serviceRequestId || null,
    alertId: task?.alertId || null,
    notes: task?.notes || null,
    source: task?.source || (task?.isManual ? 'manual' : 'auto'),
    isManual: Boolean(task?.isManual),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const trip = await db.transaction(async (tx) => {
    const [createdTrip] = await tx
      .insert(technicianTrips)
      .values({
        technicianId: payload.technicianId,
        origin,
        destinationCity,
        startDate,
        endDate,
        purpose: payload.purpose || 'pm',
        notes: payload.notes || null,
        tripStatus: 'planned',
        bookingStatus: 'not_started',
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await tx.insert(technicianTripCosts).values({
      tripId: createdTrip.id,
      travelFare: costInput.travelFare.value,
      travelFareIsManual: costInput.travelFare.isManual,
      stayCost: costInput.stayCost.value,
      stayCostIsManual: costInput.stayCost.isManual,
      dailyAllowance: costInput.dailyAllowance.value,
      dailyAllowanceIsManual: costInput.dailyAllowance.isManual,
      localTravelCost: costInput.localTravelCost.value,
      localTravelCostIsManual: costInput.localTravelCost.isManual,
      miscCost: costInput.miscCost.value,
      miscCostIsManual: costInput.miscCost.isManual,
      totalEstimatedCost: roundCurrency(totalEstimatedCost),
      currency,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (taskRows.length) {
      await tx.insert(technicianTripTasks).values(taskRows);
    }

    return createdTrip;
  });

  const costs = await storage.getTechnicianTripCosts(trip.id);
  const tasks = await storage.getTechnicianTripTasks(trip.id);

  // Auto-schedule PM service requests for PM tasks
  const pmTasks = tasks.filter(t => t.taskType === 'pm');
  const scheduledPMRequests: string[] = [];
  
  for (const pmTask of pmTasks) {
    try {
      // Check if service request already exists
      let serviceRequestId = pmTask.serviceRequestId;
      
      if (!serviceRequestId) {
        // Create PM service request if it doesn't exist
        const container = await storage.getContainer(pmTask.containerId);
        if (container && container.currentCustomerId) {
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find((u: any) => ['admin', 'super_admin'].includes(u.role?.toLowerCase()));
          const createdBy = adminUser?.id || allUsers[0]?.id;
          
          if (createdBy) {
            // Generate job order number (e.g., NOV081)
            const { generateJobOrderNumber } = await import('../utils/jobOrderGenerator');
            const jobOrderNumber = await generateJobOrderNumber();
            
            const newRequest = await storage.createServiceRequest({
              requestNumber: jobOrderNumber,  // Use job order format (e.g., NOV081)
              jobOrder: jobOrderNumber,
              containerId: pmTask.containerId,
              customerId: container.currentCustomerId,
              priority: pmTask.priority === 'CRITICAL' ? 'urgent' : 'normal',
              status: 'pending',
              issueDescription: `Preventive Maintenance - Container ${container.containerCode || container.id} (90-day threshold)`,
              requestedAt: new Date(),
              createdBy: createdBy,
              workType: 'SERVICE-AT SITE',
              jobType: 'FOC',
            });
            
            serviceRequestId = newRequest.id;
            
            // Update trip task with service request ID
            await db
              .update(technicianTripTasks)
              .set({ serviceRequestId: serviceRequestId })
              .where(eq(technicianTripTasks.id, pmTask.id));
          }
        }
      }
      
      // Schedule the service request
      if (serviceRequestId) {
        const scheduledDate = pmTask.scheduledDate ? new Date(pmTask.scheduledDate) : startDate;
        const scheduledTimeWindow = '09:00-17:00'; // Default time window
        
        await db
          .update(serviceRequests)
          .set({
            assignedTechnicianId: payload.technicianId,
            status: 'scheduled',
            scheduledDate: scheduledDate,
            scheduledTimeWindow: scheduledTimeWindow,
            assignedBy: userId || 'AUTO',
            assignedAt: new Date(),
          })
          .where(eq(serviceRequests.id, serviceRequestId));
        
        scheduledPMRequests.push(serviceRequestId);
      }
    } catch (error) {
      console.error(`[Travel Planning] Error scheduling PM service request for task ${pmTask.id}:`, error);
      // Continue with other tasks even if one fails
    }
  }

  return {
    trip,
    costs: formatCostRecordForClient(costs),
    tasks,
    scheduledPMRequests,
  };
}

export async function recalculateTripCosts(tripId: string): Promise<CostResponse> {
  const trip = await storage.getTechnicianTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  const technician = await storage.getTechnician(trip.technicianId);
  if (!technician) throw new Error("Technician not found for trip");

  const existingCosts = await storage.getTechnicianTripCosts(tripId);
  if (!existingCosts) throw new Error("Trip costs not found");

  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  const estimates = await calculateCostEstimates(technician, trip.destinationCity, startDate, endDate);

  const resolveValue = (key: CostKey) => {
    const flagKey = `${key}IsManual` as keyof TechnicianTripCost;
    const manual = Boolean(existingCosts[flagKey]);
    if (manual) {
      return Number((existingCosts as any)[key] ?? 0);
    }
    return estimates.breakdown[key].value;
  };

  await storage.updateTechnicianTripCosts(tripId, {
    currency: existingCosts.currency,
    travelFare: resolveValue('travelFare'),
    travelFareIsManual: existingCosts.travelFareIsManual,
    stayCost: resolveValue('stayCost'),
    stayCostIsManual: existingCosts.stayCostIsManual,
    dailyAllowance: resolveValue('dailyAllowance'),
    dailyAllowanceIsManual: existingCosts.dailyAllowanceIsManual,
    localTravelCost: resolveValue('localTravelCost'),
    localTravelCostIsManual: existingCosts.localTravelCostIsManual,
    miscCost: resolveValue('miscCost'),
    miscCostIsManual: existingCosts.miscCostIsManual,
  });

  const updated = await storage.getTechnicianTripCosts(tripId);
  return formatCostRecordForClient(updated);
}

