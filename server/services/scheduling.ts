import { storage } from "../storage";
import { generateServiceSchedule } from "./gemini";

export async function runDailyScheduler(): Promise<any> {
  try {
    console.log("Running daily scheduler...");

    // Get pending service requests
    const pendingRequests = await storage.getPendingServiceRequests();

    // Get available technicians
    const technicians = await storage.getAvailableTechnicians();

    if (pendingRequests.length === 0) {
      console.log("No pending service requests to schedule");
      return { success: true, message: "No pending requests" };
    }

    if (technicians.length === 0) {
      console.log("No available technicians");
      return { success: false, message: "No available technicians" };
    }

    // Prepare data for AI scheduling
    const requestsWithDetails = await Promise.all(
      pendingRequests.map(async (req) => {
        const container = await storage.getContainer(req.containerId);
        return {
          ...req,
          containerLocation: container?.currentLocation,
          containerType: container?.type,
        };
      })
    );

    const techniciansWithDetails = technicians.map((tech) => ({
      id: tech.id,
      skills: tech.skills,
      homeLocation: tech.homeLocation,
      serviceAreas: tech.serviceAreas,
    }));

    // Use Gemini AI to generate optimal schedule
    const schedule = await generateServiceSchedule(requestsWithDetails, techniciansWithDetails);

    // Update service requests with assignments
    for (const assignment of schedule.assignments) {
      for (const service of assignment.services) {
        await storage.updateServiceRequest(service.serviceRequestId, {
          assignedTechnicianId: assignment.technicianId,
          status: "scheduled",
          scheduledDate: new Date(service.estimatedStartTime),
        });
      }
    }

    console.log(`Scheduled ${pendingRequests.length} services across ${schedule.assignments.length} technicians`);

    return { success: true, schedule };
  } catch (error) {
    console.error("Scheduler error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Run scheduler daily at 6 PM (configurable)
export function startScheduler() {
  const SCHEDULE_TIME = process.env.SCHEDULE_TIME || "18:00";
  const [hour, minute] = SCHEDULE_TIME.split(":").map(Number);

  const now = new Date();
  const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

  if (scheduledTime < now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const timeUntilSchedule = scheduledTime.getTime() - now.getTime();

  setTimeout(() => {
    runDailyScheduler();
    // Schedule for next day
    setInterval(runDailyScheduler, 24 * 60 * 60 * 1000);
  }, timeUntilSchedule);

  console.log(`Scheduler will run daily at ${SCHEDULE_TIME}`);
}
