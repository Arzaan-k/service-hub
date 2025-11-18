import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';

export interface SchedulingOptimization {
  technicianId: string;
  serviceRequestId: string;
  scheduledTime: Date;
  estimatedTravelTime: number;
  estimatedServiceDuration: number;
  routeOrder: number;
  totalDistance: number;
  optimizationScore: number;
}

export interface SchedulingConstraints {
  maxWorkingHours: number;
  maxTravelDistance: number;
  skillRequirements: string[];
  priorityWeights: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
}

class AISchedulingEngine {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Optimize technician schedules using AI
   */
  async optimizeSchedules(
    date: Date,
    constraints: SchedulingConstraints = this.getDefaultConstraints()
  ): Promise<SchedulingOptimization[]> {
    try {
      // Get all pending service requests for the date
      const serviceRequests = await storage.getServiceRequestsByStatus('pending');
      const technicians = await storage.getAllTechnicians();
      
      // Filter available technicians
      const availableTechnicians = technicians.filter(t => t.isAvailable);
      
      if (availableTechnicians.length === 0) {
        throw new Error('No available technicians for scheduling');
      }

      // Group service requests by priority
      const urgentRequests = serviceRequests.filter(sr => sr.priority === 'urgent');
      const highRequests = serviceRequests.filter(sr => sr.priority === 'high');
      const normalRequests = serviceRequests.filter(sr => sr.priority === 'normal');
      const lowRequests = serviceRequests.filter(sr => sr.priority === 'low');

      const optimizations: SchedulingOptimization[] = [];

      // Process urgent requests first
      for (const request of urgentRequests) {
        const optimization = await this.optimizeSingleRequest(
          request,
          availableTechnicians,
          date,
          constraints
        );
        if (optimization) {
          optimizations.push(optimization);
        }
      }

      // Process high priority requests
      for (const request of highRequests) {
        const optimization = await this.optimizeSingleRequest(
          request,
          availableTechnicians,
          date,
          constraints
        );
        if (optimization) {
          optimizations.push(optimization);
        }
      }

      // Process normal priority requests
      for (const request of normalRequests) {
        const optimization = await this.optimizeSingleRequest(
          request,
          availableTechnicians,
          date,
          constraints
        );
        if (optimization) {
          optimizations.push(optimization);
        }
      }

      // Process low priority requests
      for (const request of lowRequests) {
        const optimization = await this.optimizeSingleRequest(
          request,
          availableTechnicians,
          date,
          constraints
        );
        if (optimization) {
          optimizations.push(optimization);
        }
      }

      // Sort by optimization score
      return optimizations.sort((a, b) => b.optimizationScore - a.optimizationScore);

    } catch (error) {
      console.error('AI Scheduling optimization error:', error);
      throw error;
    }
  }

  /**
   * Optimize a single service request
   */
  private async optimizeSingleRequest(
    serviceRequest: any,
    technicians: any[],
    date: Date,
    constraints: SchedulingConstraints
  ): Promise<SchedulingOptimization | null> {
    try {
      // Find best technician for this request
      const bestTechnician = await this.findBestTechnician(
        serviceRequest,
        technicians,
        constraints
      );

      if (!bestTechnician) {
        console.warn(`No suitable technician found for service request ${serviceRequest.id}`);
        return null;
      }

      // Calculate optimal scheduling time
      const scheduledTime = await this.calculateOptimalTime(
        serviceRequest,
        bestTechnician,
        date,
        constraints
      );

      // Calculate travel time and distance
      const travelInfo = await this.calculateTravelInfo(
        bestTechnician,
        serviceRequest,
        scheduledTime
      );

      // Calculate optimization score
      const optimizationScore = await this.calculateOptimizationScore(
        serviceRequest,
        bestTechnician,
        travelInfo,
        constraints
      );

      return {
        technicianId: bestTechnician.id,
        serviceRequestId: serviceRequest.id,
        scheduledTime,
        estimatedTravelTime: travelInfo.travelTime,
        estimatedServiceDuration: serviceRequest.estimatedDuration || 60,
        routeOrder: 1, // Will be calculated in batch optimization
        totalDistance: travelInfo.distance,
        optimizationScore
      };

    } catch (error) {
      console.error('Error optimizing single request:', error);
      return null;
    }
  }

  /**
   * Find the best technician for a service request using AI
   */
  private async findBestTechnician(
    serviceRequest: any,
    technicians: any[],
    constraints: SchedulingConstraints
  ): Promise<any | null> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `
        Analyze the following service request and available technicians to find the best match:
        
        Service Request:
        - ID: ${serviceRequest.id}
        - Issue: ${serviceRequest.issueDescription}
        - Priority: ${serviceRequest.priority}
        - Required Parts: ${serviceRequest.requiredParts?.join(', ') || 'None'}
        - Container Location: ${serviceRequest.container?.currentLocation?.address || 'Unknown'}
        
        Available Technicians:
        ${technicians.map(t => `
          - ID: ${t.id}
          - Name: ${t.name}
          - Skills: ${t.skills?.join(', ') || 'None'}
          - Experience Level: ${t.experienceLevel}
          - Current Location: ${t.currentLocation?.address || 'Unknown'}
          - Average Rating: ${t.averageRating || 'N/A'}
          - First Time Fix Rate: ${t.firstTimeFixRate || 'N/A'}%
        `).join('\n')}
        
        Constraints:
        - Required Skills: ${constraints.skillRequirements.join(', ')}
        - Max Working Hours: ${constraints.maxWorkingHours}
        
        Return the technician ID that best matches this service request based on:
        1. Required skills match
        2. Experience level appropriateness
        3. Location proximity
        4. Performance history
        5. Availability
        
        Respond with only the technician ID or "NONE" if no suitable technician found.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      if (text === 'NONE' || !text) {
        return null;
      }

      return technicians.find(t => t.id === text) || null;

    } catch (error) {
      console.error('Error finding best technician:', error);
      return null;
    }
  }

  /**
   * Calculate optimal scheduling time using AI
   */
  private async calculateOptimalTime(
    serviceRequest: any,
    technician: any,
    date: Date,
    constraints: SchedulingConstraints
  ): Promise<Date> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `
        Calculate the optimal scheduling time for this service request:
        
        Service Request:
        - Priority: ${serviceRequest.priority}
        - Issue: ${serviceRequest.issueDescription}
        - Estimated Duration: ${serviceRequest.estimatedDuration || 60} minutes
        - Container Location: ${serviceRequest.container?.currentLocation?.address || 'Unknown'}
        
        Technician:
        - Working Hours: ${technician.workingHoursStart} - ${technician.workingHoursEnd}
        - Current Location: ${technician.currentLocation?.address || 'Unknown'}
        - Experience Level: ${technician.experienceLevel}
        
        Constraints:
        - Max Working Hours: ${constraints.maxWorkingHours}
        - Priority Weight: ${constraints.priorityWeights[serviceRequest.priority as keyof typeof constraints.priorityWeights]}
        
        Consider:
        1. Priority level (urgent should be scheduled earlier)
        2. Technician's working hours
        3. Travel time to location
        4. Service duration
        5. Optimal working hours for the type of service
        
        Return the optimal start time in format: "HH:MM" (24-hour format)
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const timeString = response.text().trim();

      // Parse time and create date
      const [hours, minutes] = timeString.split(':').map(Number);
      const scheduledTime = new Date(date);
      scheduledTime.setHours(hours, minutes, 0, 0);

      return scheduledTime;

    } catch (error) {
      console.error('Error calculating optimal time:', error);
      // Fallback to default time
      const scheduledTime = new Date(date);
      scheduledTime.setHours(9, 0, 0, 0);
      return scheduledTime;
    }
  }

  /**
   * Calculate travel information
   */
  private async calculateTravelInfo(
    technician: any,
    serviceRequest: any,
    scheduledTime: Date
  ): Promise<{ travelTime: number; distance: number }> {
    // This would integrate with a real mapping service like Google Maps
    // For now, return mock data
    const mockTravelTime = Math.floor(Math.random() * 60) + 15; // 15-75 minutes
    const mockDistance = Math.floor(Math.random() * 50) + 5; // 5-55 km

    return {
      travelTime: mockTravelTime,
      distance: mockDistance
    };
  }

  /**
   * Calculate optimization score using AI
   */
  private async calculateOptimizationScore(
    serviceRequest: any,
    technician: any,
    travelInfo: { travelTime: number; distance: number },
    constraints: SchedulingConstraints
  ): Promise<number> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `
        Calculate an optimization score (0-100) for this technician assignment:
        
        Service Request:
        - Priority: ${serviceRequest.priority}
        - Issue: ${serviceRequest.issueDescription}
        - Required Parts: ${serviceRequest.requiredParts?.join(', ') || 'None'}
        
        Technician:
        - Skills: ${technician.skills?.join(', ') || 'None'}
        - Experience Level: ${technician.experienceLevel}
        - Average Rating: ${technician.averageRating || 'N/A'}
        - First Time Fix Rate: ${technician.firstTimeFixRate || 'N/A'}%
        
        Travel Info:
        - Travel Time: ${travelInfo.travelTime} minutes
        - Distance: ${travelInfo.distance} km
        
        Constraints:
        - Max Travel Distance: ${constraints.maxTravelDistance} km
        - Priority Weight: ${constraints.priorityWeights[serviceRequest.priority as keyof typeof constraints.priorityWeights]}
        
        Score based on:
        1. Skill match (40% weight)
        2. Experience appropriateness (20% weight)
        3. Travel efficiency (20% weight)
        4. Performance history (20% weight)
        
        Return only the numerical score (0-100).
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const scoreText = response.text().trim();

      return parseFloat(scoreText) || 50; // Default to 50 if parsing fails

    } catch (error) {
      console.error('Error calculating optimization score:', error);
      return 50; // Default score
    }
  }

  /**
   * Get default scheduling constraints
   */
  private getDefaultConstraints(): SchedulingConstraints {
    return {
      maxWorkingHours: 8,
      maxTravelDistance: 100,
      skillRequirements: ['container_repair', 'iot_troubleshooting'],
      priorityWeights: {
        urgent: 1.0,
        high: 0.8,
        normal: 0.6,
        low: 0.4
      }
    };
  }

  /**
   * Generate daily schedule for a technician
   */
  async generateTechnicianSchedule(
    technicianId: string,
    date: Date
  ): Promise<SchedulingOptimization[]> {
    try {
      const technician = await storage.getTechnician(technicianId);
      if (!technician) {
        throw new Error('Technician not found');
      }

      const serviceRequests = await storage.getServiceRequestsByTechnician(technicianId);
      const pendingRequests = serviceRequests.filter(sr => sr.status === 'pending');

      const optimizations: SchedulingOptimization[] = [];

      for (const request of pendingRequests) {
        const optimization = await this.optimizeSingleRequest(
          request,
          [technician],
          date,
          this.getDefaultConstraints()
        );
        if (optimization) {
          optimizations.push(optimization);
        }
      }

      // Sort by scheduled time
      return optimizations.sort((a, b) => 
        new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      );

    } catch (error) {
      console.error('Error generating technician schedule:', error);
      throw error;
    }
  }

  /**
   * Reschedule a service request
   */
  async rescheduleServiceRequest(
    serviceRequestId: string,
    newDate: Date,
    reason: string
  ): Promise<SchedulingOptimization | null> {
    try {
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        throw new Error('Service request not found');
      }

      const technicians = await storage.getAllTechnicians();
      const availableTechnicians = technicians.filter(t => t.isAvailable);

      const optimization = await this.optimizeSingleRequest(
        serviceRequest,
        availableTechnicians,
        newDate,
        this.getDefaultConstraints()
      );

      if (optimization) {
        // Update the service request with new schedule
        await storage.updateServiceRequest(serviceRequestId, {
          scheduledDate: newDate,
          status: 'scheduled'
        });
      }

      return optimization;

    } catch (error) {
      console.error('Error rescheduling service request:', error);
      throw error;
    }
  }
}

// Export singleton instance
let aiSchedulingEngine: AISchedulingEngine | null = null;

export function getAISchedulingEngine(): AISchedulingEngine {
  if (!aiSchedulingEngine) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is required for AI scheduling');
    }
    aiSchedulingEngine = new AISchedulingEngine(apiKey);
  }
  return aiSchedulingEngine;
}

// Export functions for easy use
export async function optimizeDailySchedules(date: Date): Promise<SchedulingOptimization[]> {
  const engine = getAISchedulingEngine();
  return await engine.optimizeSchedules(date);
}

export async function generateTechnicianSchedule(technicianId: string, date: Date): Promise<SchedulingOptimization[]> {
  const engine = getAISchedulingEngine();
  return await engine.generateTechnicianSchedule(technicianId, date);
}

export async function rescheduleServiceRequest(serviceRequestId: string, newDate: Date, reason: string): Promise<SchedulingOptimization | null> {
  const engine = getAISchedulingEngine();
  return await engine.rescheduleServiceRequest(serviceRequestId, newDate, reason);
}
