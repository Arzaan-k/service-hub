import { storage } from '../storage';
import { sendCustomerFeedbackRequest } from './whatsapp';

export interface FeedbackTemplate {
  id: string;
  name: string;
  questions: FeedbackQuestion[];
  ratingScale: number;
  quickFeedbackTags: string[];
}

export interface FeedbackQuestion {
  id: string;
  question: string;
  type: 'rating' | 'text' | 'multiple_choice' | 'yes_no';
  options?: string[];
  required: boolean;
}

export interface FeedbackResponse {
  serviceRequestId: string;
  customerId: string;
  technicianId: string;
  rating: number;
  feedbackText?: string;
  quickFeedbackTags: string[];
  issueResolved: boolean;
  followUpRequired: boolean;
  submittedAt: Date;
}

class FeedbackCollectionService {
  private templates: Map<string, FeedbackTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize feedback templates
   */
  private initializeTemplates(): void {
    // Standard service feedback template
    this.templates.set('standard_service', {
      id: 'standard_service',
      name: 'Standard Service Feedback',
      questions: [
        {
          id: 'overall_rating',
          question: 'How would you rate the overall service?',
          type: 'rating',
          required: true
        },
        {
          id: 'technician_rating',
          question: 'How would you rate the technician?',
          type: 'rating',
          required: true
        },
        {
          id: 'issue_resolved',
          question: 'Was your issue completely resolved?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'timeliness',
          question: 'How would you rate the timeliness of service?',
          type: 'rating',
          required: true
        },
        {
          id: 'communication',
          question: 'How would you rate the communication?',
          type: 'rating',
          required: true
        },
        {
          id: 'additional_feedback',
          question: 'Any additional comments or suggestions?',
          type: 'text',
          required: false
        }
      ],
      ratingScale: 5,
      quickFeedbackTags: [
        'Excellent service',
        'Professional technician',
        'Quick response',
        'Issue resolved quickly',
        'Good communication',
        'Poor service',
        'Unprofessional',
        'Slow response',
        'Issue not resolved',
        'Poor communication'
      ]
    });

    // Emergency service feedback template
    this.templates.set('emergency_service', {
      id: 'emergency_service',
      name: 'Emergency Service Feedback',
      questions: [
        {
          id: 'response_time',
          question: 'How would you rate the emergency response time?',
          type: 'rating',
          required: true
        },
        {
          id: 'technician_rating',
          question: 'How would you rate the technician?',
          type: 'rating',
          required: true
        },
        {
          id: 'issue_resolved',
          question: 'Was your emergency issue resolved?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'safety_concerns',
          question: 'Were there any safety concerns?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'additional_feedback',
          question: 'Any additional comments about the emergency service?',
          type: 'text',
          required: false
        }
      ],
      ratingScale: 5,
      quickFeedbackTags: [
        'Quick emergency response',
        'Professional handling',
        'Safety maintained',
        'Issue resolved quickly',
        'Poor emergency response',
        'Safety concerns',
        'Unprofessional handling'
      ]
    });
  }

  /**
   * Send feedback request to customer
   */
  async sendFeedbackRequest(serviceRequestId: string): Promise<void> {
    try {
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        throw new Error('Service request not found');
      }

      if (serviceRequest.status !== 'completed') {
        throw new Error('Service request must be completed to request feedback');
      }

      const customer = await storage.getCustomer(serviceRequest.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Send WhatsApp feedback request
      await sendCustomerFeedbackRequest(customer, serviceRequest);

      // Log feedback request
      console.log(`Feedback request sent to customer ${customer.email} for service request ${serviceRequestId}`);

    } catch (error) {
      console.error('Error sending feedback request:', error);
      throw error;
    }
  }

  /**
   * Process feedback response
   */
  async processFeedbackResponse(
    serviceRequestId: string,
    customerId: string,
    response: Partial<FeedbackResponse>
  ): Promise<any> {
    try {
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        throw new Error('Service request not found');
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const technician = serviceRequest.assignedTechnicianId 
        ? await storage.getTechnician(serviceRequest.assignedTechnicianId)
        : null;

      if (!technician) {
        throw new Error('Technician not found');
      }

      // Create feedback record
      const feedback = await storage.createFeedback({
        serviceRequestId,
        customerId,
        technicianId: technician.id,
        rating: response.rating?.toString() as any || '3',
        feedbackText: response.feedbackText,
        quickFeedbackTags: response.quickFeedbackTags || [],
        issueResolved: response.issueResolved || false,
        followUpRequired: response.followUpRequired || false,
        submittedAt: new Date()
      });

      // Update technician performance metrics
      await this.updateTechnicianPerformance(technician.id, response);

      // Check if follow-up is required
      if (response.followUpRequired || (response.rating && response.rating < 3)) {
        await this.scheduleFollowUp(serviceRequestId, feedback.id);
      }

      return feedback;

    } catch (error) {
      console.error('Error processing feedback response:', error);
      throw error;
    }
  }

  /**
   * Update technician performance metrics
   */
  private async updateTechnicianPerformance(technicianId: string, feedback: Partial<FeedbackResponse>): Promise<void> {
    try {
      const technician = await storage.getTechnician(technicianId);
      if (!technician) return;

      // Get all feedback for this technician
      const allFeedback = await storage.getFeedbackByTechnician(technicianId);
      
      // Calculate new average rating
      const totalRating = allFeedback.reduce((sum, fb) => sum + parseInt(fb.rating), 0);
      const averageRating = allFeedback.length > 0 ? totalRating / allFeedback.length : 0;

      // Calculate first-time fix rate
      const resolvedIssues = allFeedback.filter(fb => fb.issueResolved).length;
      const firstTimeFixRate = allFeedback.length > 0 ? (resolvedIssues / allFeedback.length) * 100 : 0;

      // Update technician
      await storage.updateTechnician(technicianId, {
        averageRating: averageRating.toString(),
        firstTimeFixRate: firstTimeFixRate.toString()
      });

    } catch (error) {
      console.error('Error updating technician performance:', error);
    }
  }

  /**
   * Schedule follow-up for poor feedback
   */
  private async scheduleFollowUp(serviceRequestId: string, feedbackId: string): Promise<void> {
    try {
      // This would integrate with a task management system
      // For now, just log the follow-up requirement
      console.log(`Follow-up scheduled for service request ${serviceRequestId}, feedback ${feedbackId}`);
      
      // Could create a follow-up service request or task here
      
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
    }
  }

  /**
   * Get feedback analytics
   */
  async getFeedbackAnalytics(period: 'month' | 'quarter' | 'year' = 'month'): Promise<any> {
    try {
      const allFeedback = await storage.getAllFeedback();
      const now = new Date();
      
      let startDate: Date;
      switch (period) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const periodFeedback = allFeedback.filter(fb => 
        new Date(fb.submittedAt) >= startDate
      );

      const totalResponses = periodFeedback.length;
      const averageRating = totalResponses > 0 
        ? periodFeedback.reduce((sum, fb) => sum + parseInt(fb.rating), 0) / totalResponses 
        : 0;

      const issueResolvedRate = totalResponses > 0
        ? (periodFeedback.filter(fb => fb.issueResolved).length / totalResponses) * 100
        : 0;

      const followUpRequired = periodFeedback.filter(fb => fb.followUpRequired).length;

      // Rating distribution
      const ratingDistribution = {
        5: periodFeedback.filter(fb => parseInt(fb.rating) === 5).length,
        4: periodFeedback.filter(fb => parseInt(fb.rating) === 4).length,
        3: periodFeedback.filter(fb => parseInt(fb.rating) === 3).length,
        2: periodFeedback.filter(fb => parseInt(fb.rating) === 2).length,
        1: periodFeedback.filter(fb => parseInt(fb.rating) === 1).length
      };

      // Most common feedback tags
      const allTags = periodFeedback.flatMap(fb => fb.quickFeedbackTags);
      const tagCounts = allTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      return {
        period,
        totalResponses,
        averageRating: Math.round(averageRating * 100) / 100,
        issueResolvedRate: Math.round(issueResolvedRate * 100) / 100,
        followUpRequired,
        ratingDistribution,
        topTags
      };

    } catch (error) {
      console.error('Error getting feedback analytics:', error);
      throw error;
    }
  }

  /**
   * Get technician feedback summary
   */
  async getTechnicianFeedbackSummary(technicianId: string): Promise<any> {
    try {
      const technician = await storage.getTechnician(technicianId);
      if (!technician) {
        throw new Error('Technician not found');
      }

      const feedback = await storage.getFeedbackByTechnician(technicianId);
      
      const totalFeedback = feedback.length;
      const averageRating = totalFeedback > 0 
        ? feedback.reduce((sum, fb) => sum + parseInt(fb.rating), 0) / totalFeedback 
        : 0;

      const issueResolvedRate = totalFeedback > 0
        ? (feedback.filter(fb => fb.issueResolved).length / totalFeedback) * 100
        : 0;

      const recentFeedback = feedback
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 5);

      return {
        technicianId,
        technicianName: technician.name,
        totalFeedback,
        averageRating: Math.round(averageRating * 100) / 100,
        issueResolvedRate: Math.round(issueResolvedRate * 100) / 100,
        recentFeedback
      };

    } catch (error) {
      console.error('Error getting technician feedback summary:', error);
      throw error;
    }
  }

  /**
   * Send feedback reminder
   */
  async sendFeedbackReminder(serviceRequestId: string): Promise<void> {
    try {
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        throw new Error('Service request not found');
      }

      const customer = await storage.getCustomer(serviceRequest.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check if feedback already submitted
      const existingFeedback = await storage.getFeedbackByServiceRequest(serviceRequestId);
      if (existingFeedback) {
        console.log(`Feedback already submitted for service request ${serviceRequestId}`);
        return;
      }

      // Send reminder via WhatsApp
      await sendCustomerFeedbackRequest(customer, serviceRequest);

      console.log(`Feedback reminder sent to customer ${customer.email} for service request ${serviceRequestId}`);

    } catch (error) {
      console.error('Error sending feedback reminder:', error);
      throw error;
    }
  }

  /**
   * Get feedback template
   */
  getFeedbackTemplate(templateId: string): FeedbackTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get all feedback templates
   */
  getAllFeedbackTemplates(): FeedbackTemplate[] {
    return Array.from(this.templates.values());
  }
}

// Export singleton instance
let feedbackCollectionService: FeedbackCollectionService | null = null;

export function getFeedbackCollectionService(): FeedbackCollectionService {
  if (!feedbackCollectionService) {
    feedbackCollectionService = new FeedbackCollectionService();
  }
  return feedbackCollectionService;
}

// Export functions for easy use
export async function sendFeedbackRequest(serviceRequestId: string): Promise<void> {
  const service = getFeedbackCollectionService();
  return await service.sendFeedbackRequest(serviceRequestId);
}

export async function processFeedbackResponse(
  serviceRequestId: string,
  customerId: string,
  response: Partial<FeedbackResponse>
): Promise<any> {
  const service = getFeedbackCollectionService();
  return await service.processFeedbackResponse(serviceRequestId, customerId, response);
}

export async function getFeedbackAnalytics(period: 'month' | 'quarter' | 'year' = 'month'): Promise<any> {
  const service = getFeedbackCollectionService();
  return await service.getFeedbackAnalytics(period);
}

export async function getTechnicianFeedbackSummary(technicianId: string): Promise<any> {
  const service = getFeedbackCollectionService();
  return await service.getTechnicianFeedbackSummary(technicianId);
}
