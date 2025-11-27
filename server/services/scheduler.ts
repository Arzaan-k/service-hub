import { storage } from "../storage";
import { whatsappService } from "./whatsapp";

interface RoutePoint {
  serviceRequestId: string;
  location: { lat: number; lng: number };
  estimatedTime: number;
  containerId: string;
}

interface TechnicianScore {
  technician: any;
  score: number;
  currentDayJobs: number;
  distanceKm: number;
  skillMismatch: boolean;
  rating: number;
}

export class SchedulerService {
  /**
   * Get current day job count for a technician.
   * Counts all service requests assigned to the technician for today that are not completed/cancelled.
   */
  private async getCurrentDayJobCount(technicianId: string, targetDate: Date = new Date()): Promise<number> {
    try {
      const dateStr = targetDate.toISOString().split('T')[0];
      const schedule = await storage.getTechnicianSchedule(technicianId, dateStr);
      
      // Filter out completed and cancelled requests
      const activeJobs = schedule.filter((req: any) => {
        const status = (req.status || '').toLowerCase();
        return !['completed', 'cancelled'].includes(status) && 
               !req.actualEndTime; // Also exclude if already completed
      });
      
      return activeJobs.length;
    } catch (error) {
      console.error(`[Scheduler] Error getting job count for tech ${technicianId}:`, error);
      return 0;
    }
  }

  /**
   * Check if technician has required skills for the service request.
   * Returns true if there's a skill mismatch (technician doesn't have required skills).
   */
  private checkSkillMismatch(technician: any, serviceRequest: any): boolean {
    // If technician has no skills defined, assume they can handle any request
    if (!technician.skills || !Array.isArray(technician.skills) || technician.skills.length === 0) {
      return false; // No mismatch if no skills defined (assume generalist)
    }

    // Extract keywords from issue description to infer required skills
    const issueDescription = (serviceRequest.issueDescription || '').toLowerCase();
    const requiredParts = serviceRequest.requiredParts || [];
    
    // Common skill keywords
    const skillKeywords: Record<string, string[]> = {
      'electrical': ['electrical', 'wiring', 'circuit', 'voltage', 'power', 'motor', 'compressor'],
      'mechanical': ['mechanical', 'bearing', 'pump', 'valve', 'gear', 'chain', 'belt'],
      'plumbing': ['plumbing', 'pipe', 'water', 'leak', 'drain', 'valve'],
      'refrigeration': ['refrigeration', 'cooling', 'temperature', 'refrigerant', 'condenser', 'evaporator'],
      'hvac': ['hvac', 'heating', 'ventilation', 'air conditioning', 'air conditioner'],
      'electronics': ['electronics', 'sensor', 'controller', 'display', 'board', 'pcb'],
    };

    // Check if issue description or required parts suggest specific skills needed
    const requiredSkills: string[] = [];
    for (const [skill, keywords] of Object.entries(skillKeywords)) {
      const hasKeyword = keywords.some(kw => issueDescription.includes(kw)) ||
                        requiredParts.some((part: string) => keywords.some(kw => part.toLowerCase().includes(kw)));
      if (hasKeyword) {
        requiredSkills.push(skill);
      }
    }

    // If no specific skills required, no mismatch
    if (requiredSkills.length === 0) {
      return false;
    }

    // Check if technician has at least one of the required skills
    const techSkills = technician.skills.map((s: string) => s.toLowerCase());
    const hasRequiredSkill = requiredSkills.some(rs => 
      techSkills.some(ts => ts.includes(rs.toLowerCase()) || rs.toLowerCase().includes(ts))
    );

    return !hasRequiredSkill; // Mismatch if technician doesn't have required skills
  }

  /**
   * Check if technician has overlapping time windows for the target date.
   */
  private async hasOverlappingTimeWindow(technicianId: string, targetDate: Date, estimatedDuration: number = 120): Promise<boolean> {
    try {
      const dateStr = targetDate.toISOString().split('T')[0];
      const schedule = await storage.getTechnicianSchedule(technicianId, dateStr);
      
      // If no existing schedule, no overlap
      if (!schedule || schedule.length === 0) {
        return false;
      }

      // Check if any existing scheduled service overlaps with the estimated duration
      // For simplicity, we assume services are scheduled throughout the day
      // If there are multiple services on the same day, consider it an overlap
      const activeServices = schedule.filter((req: any) => {
        const status = (req.status || '').toLowerCase();
        return !['completed', 'cancelled'].includes(status) && !req.actualEndTime;
      });

      // If technician already has active services on this day, consider it an overlap
      // (We can refine this later to check actual time windows)
      return activeServices.length > 0;
    } catch (error) {
      console.error(`[Scheduler] Error checking time window for tech ${technicianId}:`, error);
      return false; // Assume no overlap on error
    }
  }

  /**
   * Calculate technician score for load-balanced assignment.
   * Formula: score = (current_day_jobs * 3) + (distance_km * 1.5) + (skill_mismatch ? 10 : 0) - (rating * 0.5)
   * Lower score = better candidate
   */
  private async calculateTechnicianScore(
    technician: any,
    serviceRequest: any,
    containerLocation: { lat: number; lng: number },
    targetDate: Date = new Date()
  ): Promise<TechnicianScore> {
    // Get current day job count
    const currentDayJobs = await this.getCurrentDayJobCount(technician.id, targetDate);

    // Calculate distance
    const baseLocation = technician.baseLocation || technician.homeLocation || technician.location;
    let distanceKm = 0;
    if (baseLocation && typeof baseLocation.lat === 'number' && typeof baseLocation.lng === 'number') {
      distanceKm = this.haversineKm(containerLocation.lat, containerLocation.lng, baseLocation.lat, baseLocation.lng);
    } else {
      // If no location, use a high distance penalty
      distanceKm = 999;
    }

    // Check skill mismatch
    const skillMismatch = this.checkSkillMismatch(technician, serviceRequest);

    // Get rating (default to 0 if not available)
    const rating = technician.averageRating || 0;

    // Calculate score
    const score = (currentDayJobs * 3) + (distanceKm * 1.5) + (skillMismatch ? 10 : 0) - (rating * 0.5);

    return {
      technician,
      score,
      currentDayJobs,
      distanceKm,
      skillMismatch,
      rating,
    };
  }

  /**
   * Get eligible technicians for assignment (filters out inactive/on leave).
   */
  private async getEligibleTechnicians(): Promise<any[]> {
    const allTechnicians = await storage.getAllTechnicians();
    
    // Filter out technicians who are:
    // - off_duty (on leave)
    // - inactive (if status field indicates this)
    const eligible = allTechnicians.filter((tech: any) => {
      const status = (tech.status || '').toLowerCase();
      return status !== 'off_duty' && status !== 'inactive';
    });

    return eligible;
  }

  /**
   * Auto-assign the best available technician for a service request using load-balanced scoring.
   * Uses formula: score = (current_day_jobs * 3) + (distance_km * 1.5) + (skill_mismatch ? 10 : 0) - (rating * 0.5)
   * Picks technician with lowest score.
   */
  async autoAssignBestTechnician(serviceRequestId: string): Promise<{ assigned: boolean; request?: any; technicianId?: string; reason?: string }> {
    const request = await storage.getServiceRequest(serviceRequestId);
    if (!request) return { assigned: false, reason: "Service request not found" };

    const container = await storage.getContainer(request.containerId);
    if (!container) {
      return { assigned: false, reason: "Container not found" };
    }

    // If container doesn't have location, use a default location
    let containerLocation = container.currentLocation;
    if (!containerLocation || typeof containerLocation.lat !== 'number' || typeof containerLocation.lng !== 'number') {
      console.log('[Scheduler] Container has no location, using default assignment logic');
      containerLocation = { lat: 19.0760, lng: 72.8777 }; // Default to Mumbai coordinates
    }

    // Get eligible technicians (not on leave, not inactive)
    const eligibleTechs = await this.getEligibleTechnicians();
    console.log('[Scheduler] Eligible technicians:', eligibleTechs.length);
    
    if (eligibleTechs.length === 0) {
      return { assigned: false, reason: "No eligible technicians (all on leave or inactive)" };
    }

    // Calculate scores for all eligible technicians
    const targetDate = request.scheduledDate ? new Date(request.scheduledDate) : new Date();
    const scores: TechnicianScore[] = [];

    for (const tech of eligibleTechs) {
      // Check for overlapping time windows
      const hasOverlap = await this.hasOverlappingTimeWindow(tech.id, targetDate, request.estimatedDuration);
      if (hasOverlap && targetDate.toDateString() === new Date().toDateString()) {
        // Skip if has overlap on today (for future dates, we allow multiple assignments)
        console.log(`[Scheduler] Skipping tech ${tech.id} due to overlapping time window`);
        continue;
      }

      const score = await this.calculateTechnicianScore(tech, request, containerLocation, targetDate);
      scores.push(score);
    }

    if (scores.length === 0) {
      return { assigned: false, reason: "No available technicians (all have overlapping time windows)" };
    }

    // Sort by score (lowest first)
    scores.sort((a, b) => a.score - b.score);

    // Get technician with lowest score
    const bestScore = scores[0];
    const bestTech = bestScore.technician;

    console.log(`[Scheduler] Selected technician ${bestTech.id} with score ${bestScore.score.toFixed(2)} (jobs: ${bestScore.currentDayJobs}, distance: ${bestScore.distanceKm.toFixed(2)}km, skillMismatch: ${bestScore.skillMismatch}, rating: ${bestScore.rating})`);

    const scheduledDate = targetDate;
    const scheduledTimeWindow = request.scheduledTimeWindow || "ASAP";
    const updated = await storage.assignServiceRequest(serviceRequestId, bestTech.id, scheduledDate, scheduledTimeWindow);
    return { assigned: true, request: updated, technicianId: bestTech.id };
  }

  /**
   * Distribute pending service requests across multiple technicians using load-balanced scoring.
   * Uses the same scoring algorithm as autoAssignBestTechnician to ensure fair distribution.
   * 
   * NOTE: Auto-assignment ONLY uses internal technicians (third-party excluded).
   * Manual assignment via /api/assign-service supports both internal and third-party.
   */
  async distributeServicesAcrossTechnicians(serviceRequestIds?: string[]): Promise<{
    success: boolean;
    assignments: Array<{ assigned: boolean; requestId: string; technicianId?: string; reason?: string }>;
    distribution: Record<string, number>; // technicianId -> count
  }> {
    try {
      // Get unassigned requests (either provided or fetch all)
      // Include both pending and scheduled requests without technicians
      let pendingRequests: any[];
      if (serviceRequestIds && serviceRequestIds.length > 0) {
        pendingRequests = await Promise.all(
          serviceRequestIds.map(id => storage.getServiceRequest(id).catch(() => null))
        );
        // Filter for pending or scheduled requests without technicians
        pendingRequests = pendingRequests.filter(req => 
          req && 
          !req.assignedTechnicianId &&
          (req.status === 'pending' || req.status === 'scheduled') &&
          !req.actualStartTime &&
          !req.actualEndTime
        );
      } else {
        // Get all pending requests
        const pending = await storage.getPendingServiceRequests();
        // Also get scheduled requests without technicians
        const scheduled = await storage.getServiceRequestsByStatus('scheduled');
        const unassignedScheduled = scheduled.filter((req: any) => 
          !req.assignedTechnicianId && 
          !req.actualStartTime &&
          !req.actualEndTime &&
          !pending.find((p: any) => p.id === req.id) // Avoid duplicates
        );
        pendingRequests = [...pending.filter((req: any) => !req.assignedTechnicianId), ...unassignedScheduled];
      }

      console.log(`[Scheduler] Distributing ${pendingRequests.length} unassigned requests using load-balanced scoring`);

      if (pendingRequests.length === 0) {
        return { success: true, assignments: [], distribution: {} };
      }

      // Get eligible technicians (not on leave, not inactive)
      const candidateTechs = await this.getEligibleTechnicians();
      console.log(`[Scheduler] Total technician pool: ${candidateTechs.length} eligible technicians`);
      
      if (candidateTechs.length === 0) {
        return {
          success: false,
          assignments: pendingRequests.map(req => ({
            assigned: false,
            requestId: req.id,
            reason: "No eligible technicians found (all on leave or inactive)"
          })),
          distribution: {}
        };
      }

      const assignments: Array<{ assigned: boolean; requestId: string; technicianId?: string; reason?: string }> = [];
      const distribution: Record<string, number> = {};

      // Process each request sequentially to ensure workload counts are updated after each assignment
      for (let i = 0; i < pendingRequests.length; i++) {
        const request = pendingRequests[i];
        try {
          const container = await storage.getContainer(request.containerId);
          if (!container) {
            assignments.push({
              assigned: false,
              requestId: request.id,
              reason: "Container not found"
            });
            continue;
          }

          // Get container location
          let containerLocation = container.currentLocation;
          if (!containerLocation || typeof containerLocation.lat !== 'number' || typeof containerLocation.lng !== 'number') {
            containerLocation = { lat: 19.0760, lng: 72.8777 }; // Default to Mumbai coordinates
          }

          // Determine target date for assignment
          const targetDate = request.scheduledDate ? new Date(request.scheduledDate) : new Date();
          const dateStr = targetDate.toISOString().split('T')[0];

          // Calculate scores for all eligible technicians
          // IMPORTANT: We recalculate scores for each request to get updated workload counts
          const scores: TechnicianScore[] = [];

          for (const tech of candidateTechs) {
            // Check for overlapping time windows (only for today)
            if (targetDate.toDateString() === new Date().toDateString()) {
              const hasOverlap = await this.hasOverlappingTimeWindow(tech.id, targetDate, request.estimatedDuration);
              if (hasOverlap) {
                console.log(`[Scheduler] Skipping tech ${tech.id} due to overlapping time window`);
                continue;
              }
            }

            const score = await this.calculateTechnicianScore(tech, request, containerLocation, targetDate);
            scores.push(score);
          }

          if (scores.length === 0) {
            assignments.push({
              assigned: false,
              requestId: request.id,
              reason: "No available technicians (all have overlapping time windows)"
            });
            continue;
          }

          // Sort by score (lowest first)
          scores.sort((a, b) => a.score - b.score);

          // Get technician with lowest score
          const bestScore = scores[0];
          const selectedTech = bestScore.technician;

          console.log(`[Scheduler] Selected technician ${selectedTech.id} for request ${request.id} with score ${bestScore.score.toFixed(2)} (jobs: ${bestScore.currentDayJobs}, distance: ${bestScore.distanceKm.toFixed(2)}km, skillMismatch: ${bestScore.skillMismatch}, rating: ${bestScore.rating})`);

          // Assign the request
          const scheduledDate = targetDate;
          const scheduledTimeWindow = request.scheduledTimeWindow || "ASAP";
          
          try {
            await storage.assignServiceRequest(request.id, selectedTech.id, scheduledDate, scheduledTimeWindow);
            
            // Update distribution tracking
            distribution[selectedTech.id] = (distribution[selectedTech.id] || 0) + 1;
            
            assignments.push({
              assigned: true,
              requestId: request.id,
              technicianId: selectedTech.id
            });
            
            console.log(`[Scheduler] Assigned request ${request.id} to technician ${selectedTech.id} on ${dateStr}`);
          } catch (error: any) {
            console.error(`[Scheduler] Error assigning request ${request.id}:`, error);
            assignments.push({
              assigned: false,
              requestId: request.id,
              reason: error.message || "Assignment failed"
            });
          }
        } catch (error: any) {
          console.error(`[Scheduler] Error processing request ${request.id}:`, error);
          assignments.push({
            assigned: false,
            requestId: request.id,
            reason: error.message || "Processing failed"
          });
        }
      }

      console.log(`[Scheduler] Distribution complete:`, distribution);
      return {
        success: true,
        assignments,
        distribution
      };
    } catch (error: any) {
      console.error('[Scheduler] Fatal error in distributeServicesAcrossTechnicians:', error);
      throw error;
    }
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get job count for a technician on a specific date (for bucket capacity planning)
   */
  private async getJobCountForDate(technicianId: string, date: Date): Promise<number> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const schedule = await storage.getTechnicianSchedule(technicianId, dateStr);
      
      // Count only active jobs (not completed/cancelled) scheduled for this date
      const activeJobs = schedule.filter((req: any) => {
        const status = (req.status || '').toLowerCase();
        return !['completed', 'cancelled'].includes(status) && !req.actualEndTime;
      });
      
      return activeJobs.length;
    } catch (error) {
      console.error(`[AutoAssign] Error getting job count for tech ${technicianId} on ${date.toISOString()}:`, error);
      return 0;
    }
  }

  /**
   * Find next available date for a technician (bucket capacity: 3 jobs per day)
   * Starts from today and moves forward until finding a day with < 3 jobs
   */
  private async findNextAvailableDate(technicianId: string, startDate: Date = new Date()): Promise<Date> {
    const maxJobsPerDay = 3;
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    // Look up to 30 days ahead
    for (let i = 0; i < 30; i++) {
      const jobCount = await this.getJobCountForDate(technicianId, currentDate);
      if (jobCount < maxJobsPerDay) {
        return currentDate;
      }
      // Move to next day
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // If no slot found in 30 days, return the 30th day anyway (better than failing)
    return currentDate;
  }

  /**
   * Smart Auto-Assign for Internal Technicians with Bucket-Based Capacity Planning
   * 
   * Implements "Fairness" logic with capacity buckets:
   * - Each technician gets up to 3 jobs per day
   * - Starts scheduling from Today
   * - If today is full, automatically spills over to Tomorrow, then next day, etc.
   * - Uses round-robin distribution among internal technicians
   * 
   * Rules:
   * - Only INTERNAL technicians (category = 'internal')
   * - Only requests with status IN ['pending','approved','scheduled'] AND assignedTechnicianId IS NULL
   * - Bucket capacity: 3 jobs per day per technician
   * - Date spillover: Automatically finds next available date if today is full
   */
  async smartAutoAssignPending(): Promise<{
    success: boolean;
    assigned: Array<{ requestId: string; techId: string; scheduledDate: string }>;
    skipped: Array<{ requestId: string; reason: string }>;
    distributionSummary: Array<{ techId: string; countAssigned: number; totalActive: number }>;
  }> {
    try {
      console.log('[AutoAssign] Starting auto-assign for pending requests (internal technicians only)');

      // 1. Get all INTERNAL technicians (regardless of status - all internal techs can take assignments)
      const allTechnicians = await storage.getAllTechnicians();
      
      console.log(`[AutoAssign] Total technicians in database: ${allTechnicians.length}`);
      if (allTechnicians.length > 0) {
        console.log(`[AutoAssign] Sample technician categories:`, 
          allTechnicians.slice(0, 5).map((t: any) => ({ 
            id: t.id, 
            category: t.category || '(null)', 
            status: t.status || '(null)' 
          }))
        );
      }
      
      // First, try to find explicitly marked internal technicians
      let internalTechs = allTechnicians
        .filter((tech: any) => {
          // Identify internal vs third-party using category field
          const category = (tech.category || '').toLowerCase();
          const isThirdParty = category === 'third-party' || category === 'thirdparty';
          const isInternal = category === 'internal';
          // Include ALL internal technicians regardless of status
          return isInternal && !isThirdParty;
        })
        // Stable ordering so round-robin is deterministic
        .sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''));

      // Fallback: If no explicitly marked internal techs, treat all non-third-party techs as internal
      if (internalTechs.length === 0) {
        console.log('[AutoAssign] No explicitly marked internal technicians found. Using fallback: treating all non-third-party technicians as internal.');
        internalTechs = allTechnicians
          .filter((tech: any) => {
            const category = (tech.category || '').toLowerCase();
            const isThirdParty = category === 'third-party' || category === 'thirdparty';
            // Exclude only third-party, include everything else (including null/undefined category)
            return !isThirdParty;
          })
          .sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''));
        console.log(`[AutoAssign] Fallback found ${internalTechs.length} technicians (non-third-party)`);
      }

      console.log(
        `[AutoAssign] Internal techs considered (all statuses):`,
        internalTechs.map((t: any) => ({ 
          id: t.id, 
          name: t.name || t.employeeCode,
          status: t.status,
          category: t.category || '(no category - treated as internal)'
        }))
      );

      if (internalTechs.length === 0) {
        const err: any = new Error('No technicians available for assignment. Please ensure technicians exist in the database and are not marked as third-party.');
        err.code = 'NO_INTERNAL_TECHNICIANS';
        err.status = 400;
        throw err;
      }

      if (!allTechnicians || allTechnicians.length === 0) {
        const err: any = new Error('No technicians found in database');
        err.code = 'NO_TECHNICIANS_FOUND';
        err.status = 400;
        throw err;
      }

      // 2. Get all unassigned requests in allowed statuses
      const allRequests = await storage.getAllServiceRequests();
      if (!allRequests) {
        const err: any = new Error('Failed to fetch service requests from database');
        err.code = 'FETCH_REQUESTS_FAILED';
        err.status = 500;
        throw err;
      }

      // Use the same filter as getPendingServiceRequests: pending or scheduled, not completed/cancelled/in_progress
      const allowedStatuses = new Set(['pending', 'scheduled']);
      const excludedStatuses = new Set(['completed', 'cancelled', 'in_progress']);
      let unassignedRequests = allRequests.filter((req: any) => {
        if (!req || !req.id) return false;
        const status = (req.status || '').toLowerCase();
        return (
          !req.assignedTechnicianId &&
          allowedStatuses.has(status) &&
          !excludedStatuses.has(status) &&
          !req.actualStartTime &&
          !req.actualEndTime
        );
      });

      // Sort by requestedAt so distribution is fair but predictable
      unassignedRequests = unassignedRequests.sort((a: any, b: any) => {
        const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return aTime - bTime;
      });

      console.log(
        `[AutoAssign] Unassigned SRs considered:`,
        unassignedRequests.map((r: any) => ({ id: r.id, number: r.requestNumber, status: r.status }))
      );

      if (unassignedRequests.length === 0) {
        const err: any = new Error('No unassigned service requests found. All requests are already assigned or in progress.');
        err.code = 'NO_UNASSIGNED_SERVICE_REQUESTS';
        err.status = 400;
        throw err;
      }

      // 3. Initialize bucket tracking and today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 4. Round-robin assign each request with bucket capacity planning (3 jobs/day per tech)
      const assigned: Array<{ requestId: string; techId: string; scheduledDate: string }> = [];
      const skipped: Array<{ requestId: string; reason: string }> = [];
      const assignmentsByTech: Record<string, number> = {}; // Track new assignments per tech
      let techIndex = 0;

      for (const request of unassignedRequests) {
        try {
          const selectedTech = internalTechs[techIndex];
          const selectedTechId = selectedTech?.id;

          if (!selectedTechId) {
            skipped.push({
              requestId: request.id,
              reason: 'No available technicians in round-robin pool',
            });
            continue;
          }

          // Advance round-robin pointer for next iteration
          techIndex = (techIndex + 1) % internalTechs.length;

          // Find next available date for this technician (bucket capacity: 3 jobs/day)
          const scheduledDate = await this.findNextAvailableDate(selectedTechId, today);
          const scheduledTimeWindow = request.scheduledTimeWindow || 'ASAP';

          // Update DB with assignment (including assignment audit fields)
          const { db } = await import('../db');
          const { serviceRequests } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');

          await db
            .update(serviceRequests)
            .set({
              assignedTechnicianId: selectedTechId,
              assignedBy: 'AUTO',
              assignedAt: new Date(),
              status: 'scheduled',
              scheduledDate: scheduledDate,
              scheduledTimeWindow: scheduledTimeWindow,
            } as any)
            .where(eq(serviceRequests.id, request.id));

          // Update tracking
          const dateStr = scheduledDate.toISOString().split('T')[0];
          assigned.push({
            requestId: request.id,
            techId: selectedTechId,
            scheduledDate: dateStr,
          });

          assignmentsByTech[selectedTechId] = (assignmentsByTech[selectedTechId] || 0) + 1;

          console.log(
            `[AutoAssign] Assigned ${request.requestNumber} to tech ${selectedTechId} on ${dateStr}`
          );

          // Send WhatsApp notification
          try {
            const { customerCommunicationService } = await import('./whatsapp');
            await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'assigned');
          } catch (notifError) {
            console.error(
              `[AutoAssign] Failed to send WhatsApp notification for request ${request.id}:`,
              notifError
            );
          }
        } catch (error: any) {
          console.error(`[AutoAssign] Error processing request ${request.id}:`, error);
          skipped.push({
            requestId: request.id,
            reason: error.message || 'Processing failed',
          });
        }
      }

      // 5. Compute final load map for summary (total active jobs per tech)
      const loadMap: Record<string, number> = {};
      for (const tech of internalTechs) {
        const techId = tech.id;
        const activeServices = await storage.getServiceRequestsByTechnician(techId, true);
        loadMap[techId] = activeServices.filter((sr: any) => !sr.actualEndTime).length;
      }

      // 6. Build distribution summary
      const distributionSummary = internalTechs.map((tech: any) => {
        const techId = tech.id;
        const techName = tech.name || tech.employeeCode || techId;
        return {
          technicianId: techId,
          techId: techId, // Keep both for compatibility
          name: techName,
          newAssignments: assignmentsByTech[techId] || 0,
          countAssigned: assignmentsByTech[techId] || 0, // Keep both for compatibility
          totalActive: loadMap[techId] || 0,
        };
      });

      console.log(`[AutoAssign] Result per tech:`, distributionSummary);
      console.log(`[AutoAssign] Complete: ${assigned.length} assigned, ${skipped.length} skipped`);

      return {
        success: true,
        assigned,
        skipped,
        distributionSummary,
      };

    } catch (error: any) {
      console.error('[AutoAssign] Fatal error in smartAutoAssignPending:', error);
      // Re-throw with proper error structure if it already has code/status
      if (error.code && error.status) {
        throw error;
      }
      // Otherwise wrap in generic error
      const wrappedError: any = new Error(error.message || 'Auto-assignment failed');
      wrappedError.code = error.code || 'AUTO_ASSIGN_FAILED';
      wrappedError.status = error.status || 500;
      throw wrappedError;
    }
  }
  async generateDailySchedules(date: Date = new Date()) {
    console.log('[Scheduler] Generating daily schedules for', date.toDateString());

    // Get pending service requests
    const pendingRequests = await storage.getPendingServiceRequests();
    
    if (pendingRequests.length === 0) {
      console.log('[Scheduler] No pending service requests');
      return;
    }

    // Get active technicians (simplified - in production, check availability)
    const allUsers = await storage.getAllContainers(); // This is a workaround, need to implement getAllUsers
    
    // Group requests by geographic proximity (simplified clustering)
    const clusters = this.clusterByLocation(pendingRequests);
    
    // Assign to technicians
    for (const cluster of clusters) {
      // Find best technician (simplified - just get first available)
      // In production: check skills, availability, current location
      
      const schedule = await storage.createSchedule({
        technicianId: cluster.technicianId || 'default-tech-id',
        date: date,
        serviceRequests: cluster.requests.map(r => r.id),
        routeMap: cluster.route,
        totalDistance: cluster.totalDistance,
        totalDuration: cluster.totalDuration,
        status: 'pending'
      });

      // Update service requests to scheduled
      for (const request of cluster.requests) {
        await storage.updateServiceRequest(request.id, {
          status: 'scheduled',
          technicianId: cluster.technicianId,
          scheduledTime: date
        });
      }

      // Send WhatsApp schedule to technician
      // In production, fetch actual technician user
      console.log(`[Scheduler] Created schedule ${schedule.id} with ${cluster.requests.length} jobs`);
    }

    console.log('[Scheduler] Schedule generation complete');
  }

  private clusterByLocation(requests: any[]): any[] {
    // Simplified clustering - in production use K-means or similar
    // For now, just group by proximity
    
    const clusters: any[] = [];
    const processed = new Set<string>();

    for (const request of requests) {
      if (processed.has(request.id)) continue;

      const cluster = {
        technicianId: null,
        requests: [request],
        route: [],
        totalDistance: 0,
        totalDuration: request.estimatedServiceTime || 120
      };

      processed.add(request.id);

      // Find nearby requests (within ~50km)
      for (const other of requests) {
        if (processed.has(other.id)) continue;
        
        // Simplified distance check
        cluster.requests.push(other);
        processed.add(other.id);
        cluster.totalDuration += other.estimatedServiceTime || 120;

        if (cluster.requests.length >= 5) break; // Max 5 jobs per technician
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Send daily schedule to technician via WhatsApp
   */
  async sendDailyScheduleToTechnician(technicianId: string, date: Date = new Date()): Promise<void> {
    const technician = await storage.getTechnician(technicianId);
    if (!technician) return;

    const user = await storage.getUser(technician.userId);
    if (!user?.phoneNumber) return;

    // Get technician's service requests for the date
    const requests = await storage.getServiceRequestsByTechnician(technicianId);
    const todayRequests = requests.filter(req => {
      if (!req.scheduledDate) return false;
      const schedDate = new Date(req.scheduledDate);
      return schedDate.toDateString() === date.toDateString();
    });

    if (todayRequests.length === 0) {
      const message = `📅 DAILY SCHEDULE - ${date.toDateString()}

Good morning! You have no scheduled service requests for today.

Have a great day! 🌟`;
      
      const { whatsappService } = await import('./whatsapp');
      await whatsappService.sendMessage(user.phoneNumber, message);
      return;
    }

    // Build schedule message
    let message = `📅 DAILY SCHEDULE - ${date.toDateString()}

Good morning! Here's your schedule for today:

`;

    for (let i = 0; i < todayRequests.length; i++) {
      const req = todayRequests[i];
      const container = await storage.getContainer(req.containerId);
      const customer = await storage.getCustomer(req.customerId);
      
      message += `${i + 1}. ${req.scheduledTimeWindow || 'TBD'} - ${req.requestNumber}
   📦 Container: ${container?.containerCode}
   🏢 Customer: ${customer?.companyName}
   🔧 Issue: ${req.issueDescription}
   ⏱️ Est. Duration: ${req.estimatedDuration || 90} min
   📍 Location: ${container?.currentLocation ? 'GPS available' : 'Contact customer'}

`;
    }

    message += `Total jobs: ${todayRequests.length}
Estimated total time: ${todayRequests.reduce((sum, req) => sum + (req.estimatedDuration || 90), 0)} minutes

💪 Have a productive day!`;

    const { whatsappService } = await import('./whatsapp');
    await whatsappService.sendMessage(user.phoneNumber, message);
  }

  /**
   * Send daily schedules to all technicians with assignments
   */
  async sendDailySchedulesToAllTechnicians(date: Date = new Date()): Promise<void> {
    const technicians = await storage.getAllTechnicians();
    
    for (const tech of technicians) {
      try {
        await this.sendDailyScheduleToTechnician(tech.id, date);
      } catch (error) {
        console.error(`Error sending schedule to technician ${tech.id}:`, error);
      }
    }
  }

  startDailyScheduling() {
    console.log('[Scheduler] Starting daily scheduling at 6 PM');
    
    const scheduleDaily = async () => {
      const now = new Date();
      const targetHour = 18; // 6 PM
      
      if (now.getHours() === targetHour) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        await this.generateDailySchedules(tomorrow);
        
        // Send schedules to technicians for tomorrow
        await this.sendDailySchedulesToAllTechnicians(tomorrow);
      }
    };

    // Check every hour
    setInterval(scheduleDaily, 60 * 60 * 1000);
    
    // Also run immediately for testing
    this.generateDailySchedules();
  }
}

export const schedulerService = new SchedulerService();
