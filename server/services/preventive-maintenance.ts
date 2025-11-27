import { storage } from "../storage";
import { generateJobOrderNumber } from "../utils/jobOrderGenerator";

interface PMAlert {
  containerId: string;
  containerCode: string;
  daysSinceLastPM: number;
  serviceRequestId: string;
  requestNumber: string;
}

/**
 * Check all containers for preventive maintenance due dates
 * Returns containers that are overdue (last PM > 90 days ago)
 */
export async function checkPreventiveMaintenance(): Promise<PMAlert[]> {
  try {
    console.log('[PM Check] Starting preventive maintenance check...');
    
    const allContainers = await storage.getAllContainers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pmAlerts: PMAlert[] = [];
    const PM_THRESHOLD_DAYS = 90; // 3 months
    
    for (const container of allContainers) {
      try {
        // Skip if container doesn't have lastPmDate
        if (!container.lastPmDate) {
          // If no lastPmDate, check if container is old enough (created > 90 days ago)
          if (container.createdAt) {
            const createdDate = new Date(container.createdAt);
            const daysSinceCreation = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreation >= PM_THRESHOLD_DAYS) {
              // Container is old enough but never had PM - needs first PM
              const alert = await createPMServiceRequest(container, daysSinceCreation);
              if (alert) {
                pmAlerts.push(alert);
              }
            }
          }
          continue;
        }
        
        const lastPmDate = new Date(container.lastPmDate);
        lastPmDate.setHours(0, 0, 0, 0);
        
        // Calculate days since last PM
        const daysSinceLastPM = Math.floor((today.getTime() - lastPmDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if PM is overdue (> 90 days)
        if (daysSinceLastPM >= PM_THRESHOLD_DAYS) {
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
        }
      } catch (error) {
        console.error(`[PM Check] Error processing container ${container.id}:`, error);
      }
    }
    
    console.log(`[PM Check] Found ${pmAlerts.length} containers needing preventive maintenance`);
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

