import { storage } from "../storage";
import { whatsappService } from "./whatsapp";
import { schedulerService } from "./scheduler";
import { type InsertAlert } from "@shared/schema";

export class AlertService {
  /**
   * Process new alert and attempt automated resolution workflow
   */
  async processNewAlert(alertData: any): Promise<{ alert: any; serviceRequest?: any; remoteResolved?: boolean }> {
    // Create the alert first
    const alert = await storage.createAlert(alertData);
    
    // Attempt remote resolution for certain alert types
    const remoteResolution = await this.attemptRemoteResolution(alert);
    
    if (remoteResolution.resolved) {
      // Mark alert as resolved and notify client
      await storage.resolveAlert(alert.id, "remote_resolution");
      await this.notifyClientResolution(alert, remoteResolution.steps);
      return { alert, remoteResolved: true };
    }
    
    // Remote resolution failed - create service request automatically
    if (alert.severity === "critical" || alert.severity === "high") {
      const serviceRequest = await this.createServiceRequestFromAlert(alert, remoteResolution.steps);
      return { alert, serviceRequest, remoteResolved: false };
    }
    
    return { alert, remoteResolved: false };
  }

  /**
   * Attempt remote resolution based on alert type
   */
  private async attemptRemoteResolution(alert: any): Promise<{ resolved: boolean; steps: string[] }> {
    const steps: string[] = [];
    
    // Get container and check if remote resolution is possible
    const container = await storage.getContainer(alert.containerId);
    if (!container) return { resolved: false, steps };
    
    // Remote resolution logic based on alert type
    switch (alert.alertType) {
      case "temperature":
        steps.push("Checking temperature sensor readings...");
        steps.push("Attempting remote temperature calibration...");
        // Simulate remote resolution attempt
        const tempResolved = Math.random() > 0.7; // 30% success rate
        if (tempResolved) {
          steps.push("✅ Temperature issue resolved remotely via sensor recalibration");
          return { resolved: true, steps };
        }
        steps.push("❌ Remote temperature resolution failed - technician visit required");
        break;
        
      case "power":
        steps.push("Checking power system status...");
        steps.push("Attempting remote power cycle...");
        const powerResolved = Math.random() > 0.6; // 40% success rate
        if (powerResolved) {
          steps.push("✅ Power issue resolved remotely via system restart");
          return { resolved: true, steps };
        }
        steps.push("❌ Remote power resolution failed - physical inspection needed");
        break;
        
      case "connectivity":
        steps.push("Testing network connectivity...");
        steps.push("Attempting connection reset...");
        const connResolved = Math.random() > 0.5; // 50% success rate
        if (connResolved) {
          steps.push("✅ Connectivity restored remotely");
          return { resolved: true, steps };
        }
        steps.push("❌ Remote connectivity fix failed - hardware check required");
        break;
        
      default:
        steps.push("Alert type requires manual inspection");
        break;
    }
    
    return { resolved: false, steps };
  }

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
        // Simulate IoT metrics for demo purposes
        const metrics = {
          temperature: Math.floor(Math.random() * 30) - 10, // -10 to 20°C
          doorStatus: Math.random() > 0.95 ? "open" : "closed",
          powerStatus: Math.random() > 0.98 ? "off" : "on",
          batteryLevel: Math.floor(Math.random() * 40) + 60, // 60-100%
          gpsLocation: container.currentLocation,
          errorCodes: Math.random() > 0.9 ? [`ERR_${Math.floor(Math.random() * 1000)}`] : []
        };
        
        // Store metrics (if storage method exists)
        try {
          await storage.createContainerMetric({
            containerId: container.id,
            temperature: metrics.temperature,
            doorStatus: metrics.doorStatus,
            powerStatus: metrics.powerStatus,
            batteryLevel: metrics.batteryLevel,
            location: metrics.gpsLocation,
            errorCodes: metrics.errorCodes.join(','),
            rawData: JSON.stringify(metrics),
            timestamp: new Date()
          });
        } catch (metricError) {
          console.log(`[Alert Service] Metric storage not available for ${container.containerCode}`);
        }

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
        console.error(`[Alert Service] Error polling container ${container.containerCode}:`, error);
      }
    }

    console.log('[Alert Service] Poll complete');
  }

  async createAlertFromError(container: any, errorCode: string, metrics: any) {
    // Enhanced deduplication: Check for existing alerts with same error code and container
    const existingAlerts = await storage.getAlertsByContainer(container.id);
    const hasOpenAlert = existingAlerts.some(a => 
      a.alertCode === errorCode && 
      a.status === 'open' && 
      // Also check if alert was created recently (within last 5 minutes) to prevent spam
      new Date(a.detectedAt).getTime() > (Date.now() - 5 * 60 * 1000)
    );

    if (hasOpenAlert) {
      console.log(`[Alert Service] Alert already exists for ${container.containerCode || container.containerId} - ${errorCode} (deduplication active)`);
      return;
    }

    // Interpret error code locally
    const errorInfo = this.interpretErrorCode(errorCode);
    
    // Simple classification without external AI
    const classification = {
      severity: errorCode.includes('CRIT') ? 'critical' : 
                errorCode.includes('WARN') ? 'medium' : 'low',
      requiresImmediateService: errorCode.includes('CRIT') || errorCode.includes('TEMP') || errorCode.includes('POWER'),
      resolutionSteps: [
        `Investigate ${errorInfo.title}`,
        `Check ${errorInfo.description}`,
        'Contact technician if needed'
      ],
      requiredParts: ['Diagnostic tools'],
      estimatedServiceTime: 90
    };

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
    console.log(`[Alert Service] Created alert ${createdAlert.id} for container ${container.containerCode || container.containerId}`);

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
      await this.createServiceRequestFromAlertLegacy(createdAlert, container);
    }
  }

  /**
   * Create service request from unresolved alert (enhanced version)
   */
  private async createServiceRequestFromAlert(alert: any, remoteSteps: string[]): Promise<any> {
    const container = await storage.getContainer(alert.containerId);
    console.log('[Alert Service] Container found:', container ? 'Yes' : 'No');
    console.log('[Alert Service] Container currentCustomerId:', container?.currentCustomerId);
    
    if (!container) {
      throw new Error(`Container not found for alert: ${alert.containerId}`);
    }
    
    if (!container.currentCustomerId) {
      // If no customer assigned, assign to first available customer as fallback
      const customers = await storage.getAllCustomers();
      if (customers.length === 0) {
        throw new Error("No customers available to assign service request");
      }
      
      // Use the first customer as fallback
      const fallbackCustomer = customers[0];
      console.log('[Alert Service] Using fallback customer:', fallbackCustomer.id);
      
      // Update container with customer assignment
      await storage.updateContainer(container.id, {
        currentCustomerId: fallbackCustomer.id,
        assignmentDate: new Date()
      });
      
      container.currentCustomerId = fallbackCustomer.id;
    }

    // Get the customer's user ID
    const customer = await storage.getCustomer(container.currentCustomerId);
    if (!customer) {
      throw new Error("Customer not found for container");
    }

    // Generate resolution steps based on alert
    const resolutionSteps = [
      ...remoteSteps,
      "On-site inspection required:",
      this.generateResolutionStep(alert.alertType),
      "Test and verify fix",
      "Update system status"
    ];

    const serviceRequest = await storage.createServiceRequest({
      requestNumber: `SR-${Date.now()}`,
      containerId: alert.containerId,
      customerId: container.currentCustomerId,
      alertId: alert.id,
      priority: alert.severity === "critical" ? "urgent" : "high",
      issueDescription: `${alert.title}: ${alert.description}`,
      requiredParts: this.getRequiredParts(alert.alertType),
      estimatedDuration: this.getEstimatedDuration(alert.alertType),
      status: "pending",
      createdAt: new Date(),
      createdBy: customer.userId, // Use customer's user ID as creator
      requestedAt: new Date(),
    });

    // Auto-assign technician
    const assignment = await schedulerService.autoAssignBestTechnician(serviceRequest.id);
    
    // Notify client about service request creation
    await this.notifyClientServiceCreated(alert, serviceRequest, assignment);
    
    // Notify technician if assigned
    if (assignment.assigned && assignment.technicianId) {
      await this.notifyTechnicianAssignment(serviceRequest, assignment.technicianId, resolutionSteps);
    }

    return serviceRequest;
  }

  // Legacy method for backward compatibility
  async createServiceRequestFromAlertLegacy(alert: any, container: any) {
    const requestId = `SR-${Date.now().toString().slice(-6)}`;

    const serviceRequest = await storage.createServiceRequest({
      requestNumber: requestId,
      containerId: container.id,
      customerId: container.currentCustomerId,
      alertId: alert.id,
      status: 'pending',
      priority: alert.severity === "critical" ? "urgent" : "high",
      issueDescription: alert.description,
      requiredParts: alert.requiredParts,
      estimatedDuration: alert.estimatedServiceTime
    });

    console.log(`[Alert Service] Created service request ${requestId} from alert ${alert.id}`);
    return serviceRequest;
  }

  private generateResolutionStep(alertType: string): string {
    const steps = {
      temperature: "Check temperature sensors, cooling system, and insulation",
      power: "Inspect power connections, battery, and charging system", 
      connectivity: "Check antenna, SIM card, and network settings",
      door: "Inspect door seals, hinges, and locking mechanism",
      default: "Perform comprehensive system diagnostic"
    };
    return steps[alertType as keyof typeof steps] || steps.default;
  }

  private getRequiredParts(alertType: string): string[] {
    const parts = {
      temperature: ["Temperature sensor", "Cooling unit filter"],
      power: ["Battery pack", "Power cable", "Fuse"],
      connectivity: ["SIM card", "Antenna", "Network module"],
      door: ["Door seal", "Hinge lubricant", "Lock mechanism"],
      default: ["Diagnostic tools"]
    };
    return parts[alertType as keyof typeof parts] || parts.default;
  }

  private getEstimatedDuration(alertType: string): number {
    const durations = {
      temperature: 90,
      power: 60,
      connectivity: 45,
      door: 120,
      default: 90
    };
    return durations[alertType as keyof typeof durations] || durations.default;
  }

  /**
   * Notify client about remote resolution success
   */
  private async notifyClientResolution(alert: any, steps: string[]): Promise<void> {
    const container = await storage.getContainer(alert.containerId);
    if (!container?.currentCustomerId) return;

    const customer = await storage.getCustomer(container.currentCustomerId);
    if (!customer) return;

    const message = `🔧 ISSUE RESOLVED REMOTELY

Container: ${container.containerCode}
Issue: ${alert.title}

Resolution Steps:
${steps.map(step => `• ${step}`).join('\n')}

Status: ✅ Resolved
No technician visit required.`;

    await whatsappService.sendMessage(customer.whatsappNumber, message);
  }

  /**
   * Notify client about service request creation
   */
  private async notifyClientServiceCreated(alert: any, serviceRequest: any, assignment: any): Promise<void> {
    const container = await storage.getContainer(alert.containerId);
    if (!container?.currentCustomerId) return;

    const customer = await storage.getCustomer(container.currentCustomerId);
    if (!customer) return;

    const techInfo = assignment.assigned ? 
      `\n👨‍🔧 Technician: Assigned (${assignment.technicianId})\n📅 Status: Scheduled` :
      `\n👨‍🔧 Technician: Being assigned...`;

    const message = `🚨 SERVICE REQUEST CREATED

Container: ${container.containerCode}
Issue: ${alert.title}
Priority: ${serviceRequest.priority.toUpperCase()}
Request #: ${serviceRequest.requestNumber}${techInfo}

We'll keep you updated on progress.`;

    await whatsappService.sendMessage(customer.whatsappNumber, message);
  }

  /**
   * Notify technician about new assignment
   */
  private async notifyTechnicianAssignment(serviceRequest: any, technicianId: string, resolutionSteps: string[]): Promise<void> {
    const technician = await storage.getTechnician(technicianId);
    if (!technician) return;

    const user = await storage.getUser(technician.userId);
    if (!user?.phoneNumber) return;

    const container = await storage.getContainer(serviceRequest.containerId);
    const customer = await storage.getCustomer(serviceRequest.customerId);

    const message = `🔧 NEW SERVICE ASSIGNMENT

Request #: ${serviceRequest.requestNumber}
Priority: ${serviceRequest.priority.toUpperCase()}
Container: ${container?.containerCode}
Customer: ${customer?.companyName}

Issue: ${serviceRequest.issueDescription}

Resolution Steps:
${resolutionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

📍 Location: ${container?.currentLocation ? 'GPS coordinates available' : 'Contact customer for location'}
⏱️ Estimated Duration: ${serviceRequest.estimatedDuration || 90} minutes

Check your dashboard for full details.`;

    await whatsappService.sendMessage(user.phoneNumber, message);
  }

  private interpretErrorCode(errorCode: string): { title: string; description: string } {
    const errorMap: Record<string, { title: string; description: string }> = {
      'TEMP_HIGH': { title: 'High Temperature', description: 'Container temperature exceeds safe limits' },
      'TEMP_LOW': { title: 'Low Temperature', description: 'Container temperature below safe limits' },
      'POWER_LOW': { title: 'Low Power', description: 'Battery level critically low' },
      'DOOR_OPEN': { title: 'Door Open', description: 'Container door detected open' },
      'CONN_LOST': { title: 'Connection Lost', description: 'Communication with device lost' },
      'default': { title: 'System Alert', description: 'Device reported an issue' }
    };

    // Match error patterns
    if (errorCode.includes('TEMP')) return errorMap['TEMP_HIGH'];
    if (errorCode.includes('POWER')) return errorMap['POWER_LOW'];
    if (errorCode.includes('DOOR')) return errorMap['DOOR_OPEN'];
    if (errorCode.includes('CONN')) return errorMap['CONN_LOST'];
    
    return errorMap['default'];
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
