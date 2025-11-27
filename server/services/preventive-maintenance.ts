import { storage } from "../storage";
import { generateJobOrderNumber } from "../utils/jobOrderGenerator";
import { db } from "../db";
import { sql } from "drizzle-orm";

interface PMAlert {
  containerId: string;
  containerCode: string;
  daysSinceLastPM: number;
  serviceRequestId: string;
  requestNumber: string;
}

/**
 * Check all containers for preventive maintenance due dates
 * Uses service_requests table (machine_status = 'Preventive Maintenance') to determine last PM date
 * Returns containers that are overdue (last PM > 90 days ago)
 */
export async function checkPreventiveMaintenance(): Promise<PMAlert[]> {
  try {
    console.log('[PM Check] Starting preventive maintenance check using service_requests...');
    
    const PM_THRESHOLD_DAYS = 90; // 3 months
    
    // Get containers needing PM from service_requests
    const overdueContainers = await db.execute(sql`
      WITH last_pm AS (
        SELECT 
          container_id,
          MAX(complaint_registration_time) as last_pm_date
        FROM service_requests
        WHERE LOWER(machine_status) LIKE '%preventive%'
          AND container_id IS NOT NULL
        GROUP BY container_id
      )
      SELECT 
        c.id,
        c.container_id,
        c.assigned_client_id as current_customer_id,
        lp.last_pm_date,
        COALESCE(EXTRACT(DAY FROM (NOW() - lp.last_pm_date)), 999) as days_since_pm
      FROM containers c
      LEFT JOIN last_pm lp ON c.id = lp.container_id
      WHERE c.status = 'active'
        AND c.assigned_client_id IS NOT NULL
        AND (
          lp.last_pm_date IS NULL 
          OR EXTRACT(DAY FROM (NOW() - lp.last_pm_date)) > ${PM_THRESHOLD_DAYS}
        )
      ORDER BY days_since_pm DESC
      LIMIT 50
    `);

    console.log(`[PM Check] Found ${overdueContainers.rows.length} containers needing PM`);
    
    const pmAlerts: PMAlert[] = [];
    
    for (const row of overdueContainers.rows as any[]) {
      try {
        const container = {
          id: row.id,
          containerCode: row.container_id,
          currentCustomerId: row.current_customer_id,
        };
        
        const daysSinceLastPM = row.days_since_pm ? Math.round(Number(row.days_since_pm)) : 999;
        
        // Check if there's already a pending PM service request for this container
        const existingRequests = await storage.getAllServiceRequests();
        const hasPendingPM = existingRequests.some((req: any) => {
          return (
            req.containerId === container.id &&
            req.issueDescription?.toLowerCase().includes('preventive maintenance') &&
            ['pending', 'approved', 'scheduled'].includes(req.status?.toLowerCase()) &&
            !req.actualEndTime
          );
        });
        
        // Only create new PM request if one doesn't already exist
        if (!hasPendingPM) {
          const alert = await createPMServiceRequest(container, daysSinceLastPM);
          if (alert) {
            pmAlerts.push(alert);
          }
        }
      } catch (error) {
        console.error(`[PM Check] Error processing container ${row.id}:`, error);
      }
    }
    
    console.log(`[PM Check] Created ${pmAlerts.length} PM service requests`);
    return pmAlerts;
  } catch (error) {
    console.error('[PM Check] Fatal error in checkPreventiveMaintenance:', error);
    throw error;
  }
}

/**
 * Create a service request for preventive maintenance
 */
async function createPMServiceRequest(container: any, daysSinceLastPM: number): Promise<PMAlert | null> {
  try {
    // Get the container's current customer
    const customerId = container.currentCustomerId;
    if (!customerId) {
      console.warn(`[PM Check] Container ${container.containerCode} has no customer assigned, skipping PM request`);
      return null;
    }
    
    // Get a system user for createdBy (or use first admin user)
    const allUsers = await storage.getAllUsers();
    const adminUser = allUsers.find((u: any) => ['admin', 'super_admin'].includes(u.role?.toLowerCase()));
    const createdBy = adminUser?.id || allUsers[0]?.id;
    
    if (!createdBy) {
      console.error('[PM Check] No users found to create PM service request');
      return null;
    }
    
    // Generate request number
    const timestamp = Date.now();
    const requestNumber = `SR-PM-${timestamp}`;
    
    // Create the service request
    const serviceRequest = await storage.createServiceRequest({
      requestNumber: requestNumber,
      containerId: container.id,
      customerId: customerId,
      priority: 'normal',
      status: 'pending',
      issueDescription: `Preventive Maintenance Required - Container ${container.containerCode} has not been serviced for ${daysSinceLastPM} days (90-day threshold exceeded)`,
      requestedAt: new Date(),
      createdBy: createdBy,
      // Mark as PM-related
      workType: 'SERVICE-AT SITE',
      jobType: 'FOC', // Free of Charge for PM
    });
    
    // Update container PM status
    try {
      await storage.updateContainer(container.id, {
        pmStatus: 'OVERDUE',
      });
    } catch (updateError) {
      console.warn(`[PM Check] Failed to update container PM status:`, updateError);
    }
    
    return {
      containerId: container.id,
      containerCode: container.containerCode || container.containerId || 'Unknown',
      daysSinceLastPM: daysSinceLastPM,
      serviceRequestId: serviceRequest.id,
      requestNumber: requestNumber,
    };
  } catch (error) {
    console.error(`[PM Check] Error creating PM service request for container ${container.id}:`, error);
    return null;
  }
}

/**
 * Run PM check and broadcast alerts via WebSocket
 * This is called by the cron job
 */
export async function runPMCheckAndNotify(): Promise<{ alerts: PMAlert[]; count: number }> {
  try {
    const alerts = await checkPreventiveMaintenance();
    
    // Broadcast PM alerts to all connected clients (admins/coordinators)
    if (alerts.length > 0 && typeof (global as any).broadcast === 'function') {
      const broadcast = (global as any).broadcast;
      
      alerts.forEach((alert) => {
        broadcast({
          type: 'pm_alert',
          timestamp: new Date().toISOString(),
          data: {
            containerId: alert.containerId,
            containerCode: alert.containerCode,
            daysSinceLastPM: alert.daysSinceLastPM,
            serviceRequestId: alert.serviceRequestId,
            requestNumber: alert.requestNumber,
            message: `⚠️ MAINTENANCE ALERT: Container ${alert.containerCode} has reached its 90-day limit.`,
            action: `Move to Maintenance Bay`,
          },
        }, undefined, 'admin'); // Send to admins/coordinators
      });
      
      console.log(`[PM Check] Broadcasted ${alerts.length} PM alerts via WebSocket`);
    }
    
    return {
      alerts,
      count: alerts.length,
    };
  } catch (error) {
    console.error('[PM Check] Error in runPMCheckAndNotify:', error);
    throw error;
  }
}

/**
 * Start the PM checker cron job (runs daily at 12:00 AM)
 */
export function startPMChecker() {
  console.log('[PM Check] Initializing Preventive Maintenance checker (runs daily at 12:00 AM)');
  
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  midnight.setMinutes(0);
  midnight.setSeconds(0);
  
  // If it's past midnight today, schedule for tomorrow
  if (midnight < now) {
    midnight.setDate(midnight.getDate() + 1);
  }
  
  const timeUntilMidnight = midnight.getTime() - now.getTime();
  
  // Schedule first run at midnight
  setTimeout(() => {
    console.log('[PM Check] Running first PM check at midnight...');
    runPMCheckAndNotify().catch((error) => {
      console.error('[PM Check] Error in scheduled PM check:', error);
    });
    
    // Then run every 24 hours
    setInterval(() => {
      console.log('[PM Check] Running scheduled PM check...');
      runPMCheckAndNotify().catch((error) => {
        console.error('[PM Check] Error in scheduled PM check:', error);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, timeUntilMidnight);
  
  console.log(`[PM Check] PM checker will run daily at 12:00 AM (next run in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes)`);
}

