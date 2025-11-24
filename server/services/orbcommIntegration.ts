import { startOrbcommClient, stopOrbcommClient, getOrbcommClient } from './orbcommClient';
import { logOrbcommAlert, closeOrbcommLogger } from './orbcommLogger';
import { storage } from '../storage';

/**
 * Orbcomm Integration Service
 * Handles Orbcomm CDH alerts, logs them, and processes them for the Service Hub
 */

interface ProcessedAlert {
  alertId: string;
  deviceId?: string;
  containerId?: string;
  alertType: string;
  severity: string;
  description: string;
  latitude?: number;
  longitude?: number;
  timestamp: Date;
  rawData: any;
}

class OrbcommIntegrationService {
  private isRunning = false;

  /**
   * Start the Orbcomm integration
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️  Orbcomm integration already running');
      return;
    }

    console.log('🚀 Starting Orbcomm CDH integration...');

    try {
      // Start Orbcomm WebSocket client with alert handler
      await startOrbcommClient(this.handleAlert.bind(this));

      this.isRunning = true;
      console.log('✅ Orbcomm CDH integration started successfully');

    } catch (error) {
      console.error('❌ Failed to start Orbcomm integration:', error);
      throw error;
    }
  }

  /**
   * Stop the Orbcomm integration
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⏭️  Orbcomm integration not running');
      return;
    }

    console.log('🛑 Stopping Orbcomm CDH integration...');

    try {
      // Stop WebSocket client
      stopOrbcommClient();

      // Close logger
      await closeOrbcommLogger();

      this.isRunning = false;
      console.log('✅ Orbcomm CDH integration stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping Orbcomm integration:', error);
      throw error;
    }
  }

  /**
   * Handle incoming alert from Orbcomm
   */
  private async handleAlert(alert: any): Promise<void> {
    try {
      console.log('🔄 Processing Orbcomm alert...');

      // Log to Excel
      await logOrbcommAlert(alert);

      // Process alert for Service Hub
      const processedAlert = await this.processAlert(alert);

      if (processedAlert) {
        // Create service request or update container status based on alert
        await this.handleProcessedAlert(processedAlert);
      }

    } catch (error) {
      console.error('❌ Error handling Orbcomm alert:', error);
    }
  }

  /**
   * Process and normalize alert data from Orbcomm CDH
   */
  private async processAlert(alert: any): Promise<ProcessedAlert | null> {
    try {
      // Extract Orbcomm CDH event data structure
      const eventData = alert.Event || alert;
      const deviceData = eventData.DeviceData || {};
      const reeferData = eventData.ReeferData || {};
      const messageData = eventData.MessageData || {};

      // Extract device and asset IDs
      const deviceId = deviceData.DeviceID || deviceData.DeviceId || eventData.deviceId || eventData.IMEI;
      const assetId = deviceData.LastAssetID || reeferData.AssetID || eventData.AssetID;

      // Extract location from CDH structure
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (deviceData.GPSLatitude && deviceData.GPSLongitude) {
        latitude = parseFloat(deviceData.GPSLatitude);
        longitude = parseFloat(deviceData.GPSLongitude);
      }

      // Extract temperature
      const temperature = reeferData.TAmb || deviceData.DeviceTemp || eventData.Temperature;

      // Extract door status
      const doorStatus = deviceData.DoorState || eventData.DoorState;

      // Extract power status
      const powerStatus = deviceData.ExtPower !== undefined ?
        (deviceData.ExtPower ? 'on' : 'off') : eventData.PowerStatus;

      // Extract battery level
      let batteryLevel: number | undefined;
      if (deviceData.BatteryVoltage !== undefined) {
        batteryLevel = Math.min(100, Math.max(0, (deviceData.BatteryVoltage / 8.1) * 100));
      }

      // Extract active alarms
      const errorCodes: string[] = [];
      if (reeferData.ReeferAlarms && Array.isArray(reeferData.ReeferAlarms)) {
        reeferData.ReeferAlarms.forEach((alarm: any) => {
          if (alarm.Active) {
            errorCodes.push(alarm.RCAlias || `E${alarm.OemAlarm}`);
          }
        });
      }

      // Determine alert type and severity based on telemetry
      let alertType = 'telemetry';
      let severity = 'low';
      let description = 'Routine telemetry update';

      // Check for critical conditions
      if (errorCodes.length > 0) {
        alertType = 'error';
        severity = 'high';
        description = `Reefer alarms: ${errorCodes.join(', ')}`;
      } else if (temperature && (temperature < -25 || temperature > 30)) {
        alertType = 'temperature';
        severity = 'high';
        description = `Temperature out of range: ${temperature}°C`;
      } else if (doorStatus === 'Open') {
        alertType = 'door';
        severity = 'medium';
        description = 'Container door is open';
      } else if (powerStatus === 'off') {
        alertType = 'power';
        severity = 'high';
        description = 'External power failure';
      } else if (batteryLevel && batteryLevel < 20) {
        alertType = 'battery';
        severity = 'medium';
        description = `Low battery: ${Math.round(batteryLevel)}%`;
      }

      const processed: ProcessedAlert = {
        alertId: messageData.EventID || eventData.EventID || `evt_${Date.now()}`,
        deviceId: deviceId,
        alertType,
        severity,
        description,
        latitude,
        longitude,
        timestamp: messageData.EventDtm ? new Date(messageData.EventDtm) : new Date(),
        rawData: alert,
      };

      // Log telemetry data for debugging (first 5 alerts only)
      if (!this.debugLogCount) this.debugLogCount = 0;
      if (this.debugLogCount < 5) {
        console.log(`\n📊 Alert Telemetry [${processed.alertId}]:`);
        console.log(`  AssetID: ${assetId || 'N/A'}`);
        console.log(`  DeviceID: ${deviceId || 'N/A'}`);
        console.log(`  Location: ${latitude && longitude ? `${latitude}, ${longitude}` : 'N/A'}`);
        console.log(`  Temperature: ${temperature !== undefined ? `${temperature}°C` : 'N/A'}`);
        console.log(`  Power: ${powerStatus || 'N/A'}`);
        console.log(`  Battery: ${batteryLevel !== undefined ? `${Math.round(batteryLevel)}%` : 'N/A'}`);
        console.log(`  Door: ${doorStatus || 'N/A'}`);
        console.log(`  Alarms: ${errorCodes.length > 0 ? errorCodes.join(', ') : 'None'}`);
        this.debugLogCount++;
      }

      // Try to find matching container by AssetID (primary) or deviceID (fallback)
      if (assetId) {
        const container = await storage.getContainerByCode(assetId);
        if (container) {
          processed.containerId = container.id;
          console.log(`✅ Matched Orbcomm alert to container ${container.containerCode} via AssetID: ${assetId}`);
        } else {
          console.log(`⚠️  No container found for AssetID: ${assetId}`);
        }
      } else if (deviceId) {
        const container = await this.findContainerByDeviceId(deviceId);
        if (container) {
          processed.containerId = container.id;
          console.log(`✅ Matched alert to container: ${container.containerCode}`);
        } else {
          console.log(`⚠️  No container found for device ID: ${deviceId}`);
        }
      }

      return processed;

    } catch (error) {
      console.error('❌ Error processing Orbcomm alert:', error);
      return null;
    }
  }

  private debugLogCount = 0;

  /**
   * Find container by Orbcomm device ID
   */
  private async findContainerByDeviceId(deviceId: string): Promise<any | null> {
    try {
      // Query containers with matching Orbcomm device ID
      const containers = await storage.getAllContainers();
      const container = containers.find((c: any) =>
        c.orbcommDeviceId === deviceId ||
        c.orbcomm_device_id === deviceId
      );

      return container || null;

    } catch (error) {
      console.error('❌ Error finding container:', error);
      return null;
    }
  }

  /**
   * Handle processed alert (create service request, update container status, etc.)
   */
  private async handleProcessedAlert(alert: ProcessedAlert): Promise<void> {
    try {
      console.log(`🔧 Handling alert: ${alert.alertType} - ${alert.severity}`);

      // Update container with complete telemetry data first
      if (alert.containerId) {
        await this.updateContainerTelemetry(alert);
      }

      // Store alert in database for critical alerts only (must be done before creating service request)
      if (alert.severity === 'high' || alert.severity === 'critical' || alert.severity === 'medium') {
        await this.storeAlert(alert);
      }

      // Create service request after alert is stored (foreign key dependency)
      if (alert.containerId && this.shouldCreateServiceRequest(alert)) {
        await this.createServiceRequestFromAlert(alert);
      }

    } catch (error) {
      console.error('❌ Error handling processed alert:', error);
    }
  }

  /**
   * Determine if alert should trigger service request
   */
  private shouldCreateServiceRequest(alert: ProcessedAlert): boolean {
    // Create service request for critical or high severity alerts
    if (alert.severity === 'critical' || alert.severity === 'high') {
      return true;
    }

    // Create service request for specific alert types
    const criticalAlertTypes = [
      'temperature_out_of_range',
      'power_failure',
      'door_open',
      'system_error',
      'breakdown',
      'malfunction'
    ];

    return criticalAlertTypes.some(type =>
      alert.alertType.toLowerCase().includes(type)
    );
  }

  /**
   * Create service request from alert
   */
  private async createServiceRequestFromAlert(alert: ProcessedAlert): Promise<void> {
    try {
      console.log(`📝 Creating service request from alert: ${alert.alertId}`);

      const container = await storage.getContainer(alert.containerId!);
      if (!container) {
        console.log('⚠️  Container not found, skipping service request creation');
        return;
      }

      // Find customer associated with container
      const customerId = container.currentCustomerId || container.assigned_client_id;
      if (!customerId) {
        console.log('⚠️  No customer assigned to container, skipping service request creation');
        return;
      }

      // Create service request
      const serviceRequest = await storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}`,
        jobOrder: `AUTO${Date.now().toString().slice(-6)}`, // Temporary job order
        containerId: alert.containerId!,
        customerId: customerId,
        alertId: alert.alertId,
        priority: alert.severity === 'critical' ? 'urgent' : 'high',
        status: 'pending',
        issueDescription: `Orbcomm Alert: ${alert.alertType}\n${alert.description}`,
        requestedAt: new Date(),
        createdAt: new Date(),
        createdBy: 'system', // System-generated
      });

      console.log(`✅ Created service request: ${serviceRequest.requestNumber}`);

    } catch (error) {
      console.error('❌ Error creating service request from alert:', error);
    }
  }

  /**
   * Update container with complete telemetry data from alert
   */
  private async updateContainerTelemetry(alert: ProcessedAlert): Promise<void> {
    try {
      // Extract telemetry from raw data
      const eventData = alert.rawData.Event || alert.rawData;
      const deviceData = eventData.DeviceData || {};
      const reeferData = eventData.ReeferData || {};

      const updates: any = {
        lastUpdateTimestamp: alert.timestamp,
      };

      // Update location if available - store as separate lat/lng fields only
      if (alert.latitude && alert.longitude) {
        updates.locationLat = alert.latitude.toString();
        updates.locationLng = alert.longitude.toString();
      }

      // Update temperature if available
      const temperature = reeferData.TAmb || deviceData.DeviceTemp;
      if (temperature !== undefined) {
        updates.temperature = temperature;
      }

      // Update power status
      const powerStatus = deviceData.ExtPower !== undefined ?
        (deviceData.ExtPower ? 'on' : 'off') : null;
      if (powerStatus) {
        updates.powerStatus = powerStatus;
      }

      // Update device association
      if (alert.deviceId && alert.containerId) {
        const container = await storage.getContainer(alert.containerId);
        if (container && !container.orbcommDeviceId) {
          updates.orbcommDeviceId = alert.deviceId;
        }
      }

      if (!alert.containerId) {
        console.warn('⚠️  Cannot update container telemetry: containerId is undefined');
        return;
      }

      // Log the updates object to debug SQL error
      console.log('🔍 Container updates object:', JSON.stringify(updates, null, 2));

      await storage.updateContainer(alert.containerId, updates);

      console.log(`📊 Updated container telemetry: ${alert.containerId}`, {
        location: alert.latitude && alert.longitude ? `${alert.latitude}, ${alert.longitude}` : 'N/A',
        temperature: temperature !== undefined ? `${temperature}°C` : 'N/A',
        power: powerStatus || 'N/A',
      });

      // Broadcast realtime update to connected clients
      this.broadcastContainerUpdate(alert);

    } catch (error) {
      console.error('❌ Error updating container telemetry:', error);
    }
  }

  /**
   * Broadcast container update to connected WebSocket clients
   */
  private broadcastContainerUpdate(alert: ProcessedAlert): void {
    try {
      if ((global as any).broadcast) {
        (global as any).broadcast({
          type: 'container_update',
          data: {
            containerId: alert.containerId,
            deviceId: alert.deviceId,
            latitude: alert.latitude,
            longitude: alert.longitude,
            alertType: alert.alertType,
            severity: alert.severity,
            timestamp: alert.timestamp.toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('❌ Error broadcasting container update:', error);
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: ProcessedAlert): Promise<void> {
    try {
      // Create alert record if container is found
      if (alert.containerId) {
        await storage.createAlert({
          alertCode: alert.alertId,
          containerId: alert.containerId,
          alertType: this.mapAlertType(alert.alertType),
          severity: this.mapSeverity(alert.severity),
          source: 'orbcomm',
          title: alert.alertType,
          description: alert.description,
          detectedAt: alert.timestamp,
          metadata: {
            deviceId: alert.deviceId,
            latitude: alert.latitude,
            longitude: alert.longitude,
            rawData: alert.rawData,
          },
        });

        console.log(`✅ Stored alert in database: ${alert.alertId}`);
      }

    } catch (error) {
      console.error('❌ Error storing alert:', error);
    }
  }

  /**
   * Map Orbcomm alert type to system alert type
   */
  private mapAlertType(orbcommType: string): string {
    const typeMap: Record<string, string> = {
      'temperature': 'temperature',
      'power': 'power',
      'door': 'door',
      'system': 'system',
      'error': 'error',
      'warning': 'warning',
    };

    for (const [key, value] of Object.entries(typeMap)) {
      if (orbcommType.toLowerCase().includes(key)) {
        return value;
      }
    }

    return 'info';
  }

  /**
   * Map Orbcomm severity to system severity
   */
  private mapSeverity(orbcommSeverity: string): string {
    const severityMap: Record<string, string> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
    };

    return severityMap[orbcommSeverity.toLowerCase()] || 'medium';
  }

  /**
   * Get integration status
   */
  public getStatus() {
    const client = getOrbcommClient();
    return {
      isRunning: this.isRunning,
      clientStats: client ? client.getStats() : null,
    };
  }
}

// Singleton instance
let integrationService: OrbcommIntegrationService | null = null;

/**
 * Get or create the Orbcomm integration service
 */
export function getOrbcommIntegration(): OrbcommIntegrationService {
  if (!integrationService) {
    integrationService = new OrbcommIntegrationService();
  }
  return integrationService;
}

/**
 * Start Orbcomm integration
 */
export async function startOrbcommIntegration(): Promise<void> {
  const service = getOrbcommIntegration();
  await service.start();
}

/**
 * Stop Orbcomm integration
 */
export async function stopOrbcommIntegration(): Promise<void> {
  const service = getOrbcommIntegration();
  await service.stop();
}

export { OrbcommIntegrationService };
