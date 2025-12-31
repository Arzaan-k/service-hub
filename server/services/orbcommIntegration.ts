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
  shouldCreateAlert?: boolean; // Flag for smart alert filtering
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
      // SMART ALERTS: Only create alerts for actionable conditions, not routine telemetry
      let alertType = 'telemetry';
      let severity = 'low';
      let description = 'Routine telemetry update';
      let shouldCreateAlert = false; // Only create alerts for critical conditions

      // Check for critical conditions
      if (errorCodes.length > 0) {
        alertType = 'error';
        severity = 'critical';
        description = `Reefer alarms: ${errorCodes.join(', ')}`;
        shouldCreateAlert = true; // Critical: Equipment errors
      } else if (temperature && (temperature < -30 || temperature > 35)) {
        // Extreme temperature ranges only (previously -25 to 30)
        alertType = 'temperature';
        severity = 'high';
        description = `Temperature critically out of range: ${Math.round(temperature)}°C`;
        shouldCreateAlert = true; // High: Critical temperature
      } else if (temperature && (temperature < -25 || temperature > 30)) {
        // Warning range (don't create alert, just log)
        alertType = 'temperature';
        severity = 'medium';
        description = `Temperature warning: ${Math.round(temperature)}°C`;
        shouldCreateAlert = false; // Medium: Just monitor, don't alert
      } else if (doorStatus === 'Open') {
        alertType = 'door';
        severity = 'medium';
        description = 'Container door is open';
        shouldCreateAlert = false; // Don't alert for door open - often intentional
      } else if (powerStatus === 'off') {
        alertType = 'power';
        severity = 'high';
        description = 'External power failure';
        shouldCreateAlert = true; // High: Power failure is critical
      } else if (batteryLevel && batteryLevel < 10) {
        // Only alert for critically low battery (previously <20)
        alertType = 'battery';
        severity = 'high';
        description = `Battery critically low: ${Math.round(batteryLevel)}%`;
        shouldCreateAlert = true; // High: Battery almost dead
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
        shouldCreateAlert, // Flag to determine if alert should be saved to database
      };

      // Log telemetry data for debugging (first 5 alerts only)
      if (!this.debugLogCount) this.debugLogCount = 0;
      if (this.debugLogCount < 5) {
        console.log(`\n📊 Alert Telemetry [${processed.alertId}]:`);
        console.log(`  AssetID: ${assetId || 'N/A'}`);
        console.log(`  DeviceID: ${deviceId || 'N/A'}`);
        console.log(`  Location: ${latitude && longitude ? `${latitude}, ${longitude}` : 'N/A'}`);
        console.log(`  Temperature: ${temperature !== undefined ? `${Math.round(temperature)}°C` : 'N/A'}`);
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
      // Use optimized query instead of loading all containers
      const container = await storage.getContainerByDeviceId(deviceId);
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
      // Always update container telemetry (location, temperature, etc.)
      if (alert.containerId) {
        await this.updateContainerTelemetry(alert);
      }

      // SMART ALERTS: Only store alerts that meet criteria
      if (alert.shouldCreateAlert) {
        console.log(`🔧 Creating alert: ${alert.alertType} - ${alert.severity} (${alert.description})`);
        await this.storeAlert(alert);
      } else {
        // Just log routine telemetry without creating alerts
        console.log(`📊 Telemetry update: ${alert.alertType} - ${alert.severity} (${alert.description})`);
      }

      // Service requests are NOT automatically created - users will create them manually from alerts

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
  private async createServiceRequestFromAlert(alert: ProcessedAlert, alertDatabaseId: string): Promise<void> {
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

      // Generate job order number (e.g., NOV081)
      const { generateJobOrderNumber } = await import('../utils/jobOrderGenerator');
      const jobOrderNumber = await generateJobOrderNumber();

      // Create service request with the database ID of the alert
      const serviceRequest = await storage.createServiceRequest({
        requestNumber: jobOrderNumber,  // Use job order format (e.g., NOV081)
        jobOrder: jobOrderNumber,
        containerId: alert.containerId!,
        customerId: customerId,
        alertId: alertDatabaseId, // Use the database ID, not the alert code
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
        hasIot: true, // Mark as IoT-enabled when receiving Orbcomm data
      };

      // Update location if available - store as separate lat/lng fields only
      if (alert.latitude && alert.longitude) {
        updates.locationLat = alert.latitude.toString();
        updates.locationLng = alert.longitude.toString();
      }

      // Update temperature if available - store as rounded integer
      const temperature = reeferData.TAmb || deviceData.DeviceTemp || eventData.Temperature;
      if (temperature !== undefined) {
        updates.temperature = Math.round(temperature);
      }

      // Update power status
      let powerStatus = deviceData.ExtPower !== undefined ?
        (deviceData.ExtPower ? 'on' : 'off') : null;

      if (!powerStatus && eventData.PowerStatus) {
        powerStatus = eventData.PowerStatus.toLowerCase();
      }

      if (powerStatus) {
        updates.powerStatus = powerStatus;
      }

      // Extract battery level
      let batteryLevel: number | undefined;
      if (deviceData.BatteryVoltage !== undefined) {
        batteryLevel = Math.min(100, Math.max(0, (deviceData.BatteryVoltage / 8.1) * 100));
      } else if (eventData.BatteryLevel !== undefined) {
        batteryLevel = eventData.BatteryLevel;
      }

      // Extract door status
      const doorStatus = deviceData.DoorState || reeferData.DoorState || eventData.DoorState;

      // Store complete telemetry in lastTelemetry JSONB field
      updates.lastTelemetry = {
        temperature: temperature !== undefined ? Math.round(temperature) : undefined,
        powerStatus: powerStatus,
        batteryLevel: batteryLevel !== undefined ? Math.round(batteryLevel) : undefined,
        doorStatus: doorStatus,
        latitude: alert.latitude,
        longitude: alert.longitude,
        deviceId: alert.deviceId,
        timestamp: alert.timestamp.toISOString(),
        rawData: alert.rawData, // Store complete raw data for debugging
      };

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

      await storage.updateContainer(alert.containerId, updates);

      console.log(`📊 Updated container telemetry: ${alert.containerId}`, {
        location: alert.latitude && alert.longitude ? `${alert.latitude}, ${alert.longitude}` : 'N/A',
        temperature: temperature !== undefined ? `${Math.round(temperature)}°C` : 'N/A',
        power: powerStatus || 'N/A',
        battery: batteryLevel !== undefined ? `${Math.round(batteryLevel)}%` : 'N/A',
        door: doorStatus || 'N/A',
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
        // Extract additional telemetry data
        const eventData = alert.rawData?.Event || alert.rawData;
        const deviceData = eventData?.DeviceData || {};
        const reeferData = eventData?.ReeferData || {};

        const temperature = reeferData.TAmb || deviceData.DeviceTemp || eventData.Temperature;

        let powerStatus = deviceData.ExtPower !== undefined ?
          (deviceData.ExtPower ? 'on' : 'off') : undefined;

        if (!powerStatus && eventData.PowerStatus) {
          powerStatus = eventData.PowerStatus.toLowerCase();
        }

        // Extract battery level
        let batteryLevel: number | undefined;
        if (deviceData.BatteryVoltage !== undefined) {
          batteryLevel = Math.min(100, Math.max(0, (deviceData.BatteryVoltage / 8.1) * 100));
        } else if (eventData.BatteryLevel !== undefined) {
          batteryLevel = eventData.BatteryLevel;
        }

        // Extract door status
        const doorStatus = deviceData.DoorState || reeferData.DoorState || eventData.DoorState;

        (global as any).broadcast({
          type: 'container_update',
          data: {
            containerId: alert.containerId,
            deviceId: alert.deviceId,
            latitude: alert.latitude,
            longitude: alert.longitude,
            temperature: temperature !== undefined ? Math.round(temperature) : undefined,
            powerStatus: powerStatus,
            batteryLevel: batteryLevel !== undefined ? Math.round(batteryLevel) : undefined,
            doorStatus: doorStatus,
            alertType: alert.alertType,
            severity: alert.severity,
            timestamp: alert.timestamp.toISOString(),
          },
        });

        console.log(`📡 Broadcasted container update: ${alert.containerId}`, {
          location: `${alert.latitude}, ${alert.longitude}`,
          temperature: temperature !== undefined ? `${Math.round(temperature)}°C` : 'N/A',
          power: powerStatus || 'N/A',
          battery: batteryLevel !== undefined ? `${Math.round(batteryLevel)}%` : 'N/A',
          door: doorStatus || 'N/A',
        });
      }
    } catch (error) {
      console.error('❌ Error broadcasting container update:', error);
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: ProcessedAlert): Promise<any> {
    try {
      // Create alert record if container is found
      if (alert.containerId) {
        // Check for duplicate alerts - prevent spamming dashboard
        const existingAlerts = await storage.getAlertsByContainer(alert.containerId);
        const mappedAlertType = this.mapAlertType(alert.alertType);

        const recentDuplicate = existingAlerts.find(a =>
          a.alertType === mappedAlertType &&
          a.status === 'open' &&
          // Check if alert was created in the last 5 minutes (configurable threshold)
          new Date(a.detectedAt).getTime() > (Date.now() - 5 * 60 * 1000)
        );

        if (recentDuplicate) {
          // For temperature alerts, check if the change is significant enough (threshold-based)
          if (mappedAlertType === 'temperature') {
            const currentTemp = this.extractTemperatureFromAlert(alert);
            const previousTemp = this.extractTemperatureFromDescription(recentDuplicate.description);

            if (currentTemp !== null && previousTemp !== null) {
              // Round temperatures to whole numbers for comparison
              const currentTempRounded = Math.round(currentTemp);
              const previousTempRounded = Math.round(previousTemp);
              const tempDifference = Math.abs(currentTempRounded - previousTempRounded);
              const TEMPERATURE_THRESHOLD = 1; // Only create new alert if temp changed by ±1°C

              if (tempDifference < TEMPERATURE_THRESHOLD) {
                console.log(`⏭️  Skipping temperature alert - change of ${tempDifference}°C is below threshold of ${TEMPERATURE_THRESHOLD}°C (current: ${currentTempRounded}°C, previous: ${previousTempRounded}°C)`);
                return recentDuplicate;
              } else {
                console.log(`✅ Temperature changed significantly by ${tempDifference}°C (${previousTempRounded}°C → ${currentTempRounded}°C) - creating new alert`);
              }
            }
          } else {
            // For non-temperature alerts, use standard time-based deduplication
            console.log(`⏭️  Skipping duplicate ${mappedAlertType} alert for container ${alert.containerId} (last alert ${Math.floor((Date.now() - new Date(recentDuplicate.detectedAt).getTime()) / 1000)}s ago)`);
            return recentDuplicate;
          }
        }

        const storedAlert = await storage.createAlert({
          alertCode: alert.alertId,
          containerId: alert.containerId,
          alertType: mappedAlertType,
          severity: this.mapSeverity(alert.severity),
          source: 'orbcomm',
          title: alert.alertType,
          description: alert.description,
          detectedAt: alert.timestamp,
          status: 'open',
          metadata: {
            deviceId: alert.deviceId,
            latitude: alert.latitude,
            longitude: alert.longitude,
            rawData: alert.rawData,
          },
        });

        console.log(`✅ Stored alert in database: ${alert.alertId}`);

        // Broadcast alert creation to connected clients
        if ((global as any).broadcast) {
          (global as any).broadcast({
            type: 'alert_created',
            data: storedAlert,
          });
        }

        return storedAlert;
      }

      return null;

    } catch (error) {
      console.error('❌ Error storing alert:', error);
      return null;
    }
  }

  /**
   * Extract temperature from ProcessedAlert
   */
  private extractTemperatureFromAlert(alert: ProcessedAlert): number | null {
    try {
      const eventData = alert.rawData?.Event || alert.rawData;
      const deviceData = eventData?.DeviceData || {};
      const reeferData = eventData?.ReeferData || {};

      const temp = reeferData.TAmb || deviceData.DeviceTemp || eventData?.Temperature;
      return temp !== undefined ? parseFloat(temp) : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract temperature from alert description string
   * Example: "Temperature out of range: 35.2°C" → 35.2
   */
  private extractTemperatureFromDescription(description: string): number | null {
    try {
      // Match patterns like "35.2°C" or "35°C" or "-10.5°C"
      const tempMatch = description.match(/(-?\d+(?:\.\d+)?)\s*°C/);
      if (tempMatch && tempMatch[1]) {
        return parseFloat(tempMatch[1]);
      }
      return null;
    } catch {
      return null;
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
