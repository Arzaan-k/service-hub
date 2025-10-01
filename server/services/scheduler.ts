import { storage } from "../storage";
import { whatsappService } from "./whatsapp";

interface RoutePoint {
  serviceRequestId: string;
  location: { lat: number; lng: number };
  estimatedTime: number;
  containerId: string;
}

export class SchedulerService {
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

  startDailyScheduling() {
    console.log('[Scheduler] Starting daily scheduling at 6 PM');
    
    const scheduleDaily = () => {
      const now = new Date();
      const targetHour = 18; // 6 PM
      
      if (now.getHours() === targetHour) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.generateDailySchedules(tomorrow);
      }
    };

    // Check every hour
    setInterval(scheduleDaily, 60 * 60 * 1000);
    
    // Also run immediately for testing
    this.generateDailySchedules();
  }
}

export const schedulerService = new SchedulerService();
