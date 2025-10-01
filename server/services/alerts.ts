import { storage } from "../storage";
import { orbcommService } from "./orbcomm";
import { classifyAlert } from "./gemini";
import { whatsappService } from "./whatsapp";
import { type InsertAlert } from "@shared/schema";

export class AlertService {
  async pollIoTDevices() {
    console.log('[Alert Service] Starting IoT device poll...');
    
    // Get all IoT-enabled containers
    const containers = await storage.getAllContainers();
    const iotContainers = containers.filter(c => 
      c.type === 'iot_enabled' && c.orbcommDeviceId
    );

    console.log(`[Alert Service] Polling ${iotContainers.length} IoT containers`);

    for (const container of iotContainers) {
      try {
        const metrics = await orbcommService.fetchContainerMetrics(container.orbcommDeviceId!);
        
        // Store metrics
        await storage.createIotMetric({
          containerId: container.id,
          temperature: metrics.temperature,
          doorStatus: metrics.doorStatus,
          powerStatus: metrics.powerStatus,
          batteryLevel: metrics.batteryLevel,
          gpsLocation: metrics.gpsLocation,
          errorCodes: metrics.errorCodes || [],
          rawData: metrics,
          timestamp: new Date()
        });

        // Update container location
        if (metrics.gpsLocation) {
          await storage.updateContainer(container.id, {
            currentLocation: metrics.gpsLocation,
            lastSyncTime: new Date()
          });
        }

        // Check for errors and create alerts
        if (metrics.errorCodes && metrics.errorCodes.length > 0) {
          for (const errorCode of metrics.errorCodes) {
            await this.createAlertFromError(container, errorCode, metrics);
          }
        }

      } catch (error) {
        console.error(`[Alert Service] Error polling container ${container.containerId}:`, error);
      }
    }

    console.log('[Alert Service] Poll complete');
  }

  async createAlertFromError(container: any, errorCode: string, metrics: any) {
    // Check if alert already exists for this error
    const existingAlerts = await storage.getAlertsByContainer(container.id);
    const hasOpenAlert = existingAlerts.some(a => 
      a.alertCode === errorCode && a.status === 'open'
    );

    if (hasOpenAlert) {
      console.log(`[Alert Service] Alert already exists for ${container.containerId} - ${errorCode}`);
      return;
    }

    const errorInfo = orbcommService.interpretErrorCode(errorCode);
    
    // Use Gemini AI to classify the alert
    const classification = await classifyAlert(
      errorCode,
      errorInfo.description,
      container.model,
      metrics
    );

    const alert: InsertAlert = {
      containerId: container.id,
      alertCode: errorCode,
      severity: classification.severity,
      status: 'open',
      title: errorInfo.title,
      description: errorInfo.description,
      aiClassification: classification,
      resolutionSteps: classification.resolutionSteps,
      requiredParts: classification.requiredParts,
      estimatedServiceTime: classification.estimatedServiceTime,
      detectedAt: new Date()
    };

    const createdAlert = await storage.createAlert(alert);
    console.log(`[Alert Service] Created alert ${createdAlert.id} for container ${container.containerId}`);

    // Notify client via WhatsApp if they exist
    if (container.currentClientId) {
      const client = await storage.getUser(container.currentClientId);
      if (client) {
        try {
          await whatsappService.sendAlertNotification(
            client.phoneNumber,
            createdAlert,
            container
          );
          
          // Log WhatsApp message
          await storage.createWhatsappMessage({
            phoneNumber: client.phoneNumber,
            userId: client.id,
            direction: 'outbound',
            messageType: 'interactive',
            content: { alert: createdAlert, container },
            isAutomated: true,
            contextId: createdAlert.id,
            contextType: 'alert'
          });
        } catch (error) {
          console.error('[Alert Service] WhatsApp notification error:', error);
        }
      }
    }

    // Auto-create service request for critical/high severity
    if (classification.requiresImmediateService) {
      await this.createServiceRequestFromAlert(createdAlert, container);
    }
  }

  async createServiceRequestFromAlert(alert: any, container: any) {
    const requestId = `SR-${Date.now().toString().slice(-6)}`;
    
    const serviceRequest = await storage.createServiceRequest({
      requestId,
      containerId: container.id,
      clientId: container.currentClientId,
      alertId: alert.id,
      status: 'pending',
      priority: alert.severity,
      issueDescription: alert.description,
      requiredParts: alert.requiredParts,
      estimatedCost: null,
      actualCost: null
    });

    console.log(`[Alert Service] Created service request ${requestId} from alert ${alert.id}`);
    return serviceRequest;
  }

  startPolling(intervalMinutes: number = 5) {
    console.log(`[Alert Service] Starting polling every ${intervalMinutes} minutes`);
    
    // Initial poll
    this.pollIoTDevices();
    
    // Set up interval
    setInterval(() => {
      this.pollIoTDevices();
    }, intervalMinutes * 60 * 1000);
  }
}

export const alertService = new AlertService();
