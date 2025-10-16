import { storage } from "../storage";
import { whatsappService } from "./whatsapp";

interface RoutePoint {
  serviceRequestId: string;
  location: { lat: number; lng: number };
  estimatedTime: number;
  containerId: string;
}

export class SchedulerService {
  /**
   * Auto-assign the best available technician for a service request.
   * Picks nearest available tech to the container's currentLocation.
   */
  async autoAssignBestTechnician(serviceRequestId: string): Promise<{ assigned: boolean; request?: any; technicianId?: string; reason?: string }> {
    const request = await storage.getServiceRequest(serviceRequestId);
    if (!request) return { assigned: false, reason: "Service request not found" };

    const container = await storage.getContainer(request.containerId);
    if (!container) {
      return { assigned: false, reason: "Container not found" };
    }

    // If container doesn't have location, use a default location or assign to first available technician
    let containerLocation = container.currentLocation;
    if (!containerLocation || typeof containerLocation.lat !== 'number' || typeof containerLocation.lng !== 'number') {
      console.log('[Scheduler] Container has no location, using default assignment logic');
      containerLocation = { lat: 19.0760, lng: 72.8777 }; // Default to Mumbai coordinates
    }

    const availableTechs = await storage.getAvailableTechnicians();
    console.log('[Scheduler] Available technicians:', availableTechs.length);
    if (!availableTechs || availableTechs.length === 0) {
      return { assigned: false, reason: "No available technicians" };
    }

    // Compute nearest technician by haversine distance from baseLocation
    const target = { lat: containerLocation.lat, lng: containerLocation.lng };
    let bestTech: any | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const tech of availableTechs as any[]) {
      const base = tech.baseLocation || tech.homeLocation || tech.location; // tolerate variants
      if (!base || typeof base.lat !== 'number' || typeof base.lng !== 'number') {
        // If technician has no location, treat as fallback option
        if (!bestTech) {
          bestTech = tech;
          bestDist = 0; // Assign distance 0 for technicians without location
        }
        continue;
      }
      const d = this.haversineKm(target.lat, target.lng, base.lat, base.lng);
      if (d < bestDist) {
        bestDist = d;
        bestTech = tech;
      }
    }

    if (!bestTech) {
      return { assigned: false, reason: "No available technicians found" };
    }

    const scheduledDate = new Date();
    const scheduledTimeWindow = "ASAP";
    const updated = await storage.assignServiceRequest(serviceRequestId, bestTech.id, scheduledDate, scheduledTimeWindow);
    return { assigned: true, request: updated, technicianId: bestTech.id };
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
