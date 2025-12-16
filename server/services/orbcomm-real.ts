// Real Orbcomm API integration
import WebSocket from 'ws';

export interface OrbcommDeviceData {
  deviceId: string;
  assetId?: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  temperature?: number;
  doorStatus?: "open" | "closed";
  powerStatus?: "on" | "off";
  batteryLevel?: number;
  errorCodes?: string[];
  rawData?: any;
}

export interface OrbcommDevice {
  deviceId: string;
  deviceName?: string;
  status: "active" | "inactive" | "offline";
  lastSeen?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  temperature?: number;
  doorStatus?: string;
  powerStatus?: string;
  batteryLevel?: number;
  errorCodes?: string[];
  rawEvent?: any;
  deviceData?: any;
  reeferData?: any;
}

class OrbcommAPIClient {
  private ws: WebSocket | null = null;
  public get isConnected(): boolean {
    return this._isConnected;
  }

  private _isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private devices: OrbcommDevice[] = [];
  private deviceData: { [deviceId: string]: OrbcommDeviceData } = {};
  private requestInProgress = false; // Prevent multiple simultaneous requests

  constructor(
    private url: string,
    private username: string,
    private password: string
  ) { }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to Orbcomm CDH API...');
        console.log(`📍 URL: ${this.url}`);
        console.log(`👤 Username: ${this.username}`);

        // Create WebSocket connection with CDH protocol per ORBCOMM support instructions
        // Must use subprotocol 'cdh.orbcomm.com' and specific Basic Auth format
        this.ws = new WebSocket(
          this.url,
          'cdh.orbcomm.com', // Required subprotocol per ORBCOMM support
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
              'User-Agent': 'ContainerGenie/1.0',
              'Origin': 'https://container-genie.com'
            },
            // Add connection options for better reliability
            handshakeTimeout: 30000, // 30 second timeout
            perMessageDeflate: false, // Disable compression
            rejectUnauthorized: false // Allow self-signed certificates for testing
          }
        );

        this.ws.on('open', () => {
          console.log('✅ Connected to Orbcomm CDH WebSocket');
          this._isConnected = true;
          this.reconnectAttempts = 0;

          // Wait a moment before sending initial request to avoid session conflicts
          setTimeout(() => {
            this.sendAuthMessage();
          }, 2000); // 2 second delay

          // Set up periodic refresh after initial connection
          setTimeout(() => {
            this.sendPeriodicRequest();
          }, 10000); // Wait 10 seconds before first periodic request

          // Set up regular periodic requests - per ORBCOMM docs, be conservative with timing
          setInterval(() => {
            this.sendPeriodicRequest();
          }, 120000); // Refresh every 2 minutes (very conservative timing to avoid 2006 faults)

          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('❌ CDH WebSocket error:', error);
          console.error('❌ Error details:', {
            code: (error as any).code,
            errno: (error as any).errno,
            syscall: (error as any).syscall,
            message: error.message
          });
          this._isConnected = false;
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 CDH WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
          this._isConnected = false;
          this.requestInProgress = false; // Reset request flag on disconnect
          this.handleReconnect();
        });

        this.ws.on('message', (data) => {
          try {
            const raw = data.toString();
            // Sanitize control characters which break JSON.parse
            const cleaned = raw.replace(/[\u0000-\u001F]+/g, ' ');
            const message = JSON.parse(cleaned);
            console.log('📨 Received CDH message:', JSON.stringify(message, null, 2));
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing CDH message:', error);
            console.log('Raw message:', data.toString());
            // If message looks like a faults envelope, ignore without crashing
          }
        });

      } catch (error) {
        console.error('❌ Error creating CDH WebSocket:', error);
        reject(error);
      }
    });
  }

  private sendAuthMessage(): void {
    if (!this.ws || !this.isConnected) {
      console.log('❌ CDH not connected, cannot send auth message...');
      return;
    }

    if (this.requestInProgress) {
      console.log('⏳ CDH request already in progress, skipping auth message...');
      return;
    }

    this.requestInProgress = true;

    // GetEvents message using correct CDH protocol format per documentation
    const getEventsMessage = {
      "GetEvents": {
        "EventType": "all",                    // Required - only valid value per CDH spec
        "EventPartition": 1,                   // Required - integer 1-4
        "PrecedingEventID": "",                // Optional - UUID string (36 chars)
        "FollowingEventID": null,               // Optional - UUID string or null
        "MaxEventCount": 1000                  // Optional - integer 1-50,000
      }
    };

    console.log('🔐 Sending CDH GetEvents request...');
    console.log('📋 Request:', JSON.stringify(getEventsMessage, null, 2));

    try {
      this.ws.send(JSON.stringify(getEventsMessage));
    } catch (error) {
      console.error('❌ Failed to send CDH auth request:', error);
      this.requestInProgress = false; // Reset flag on send failure
    }

    // Reset request flag after a delay
    setTimeout(() => {
      this.requestInProgress = false;
    }, 10000); // 10 second timeout for initial request
  }

  private handleMessage(message: any): void {
    console.log('📨 Processing CDH message:', message);

    // Handle CDH fault responses per documentation
    if (message.faults && Array.isArray(message.faults)) {
      for (const faultWrapper of message.faults) {
        const fault = faultWrapper.fault || faultWrapper; // Handle nested fault structure
        console.log(`⚠️ CDH Fault - Code: ${fault.faultCode}, Severity: ${fault.faultSeverity}, Text: ${fault.faultText}`);

        // Handle specific fault codes per CDH documentation
        switch (fault.faultCode) {
          case 2001:
            console.error('❌ Unallocated partition number - check EventPartition parameter');
            break;
          case 2002:
            console.error('❌ Preceding event not found - check PrecedingEventID');
            break;
          case 2003:
            console.error('❌ Following event must be null/empty when preceding event is not provided');
            break;
          case 2004:
            console.error('❌ Following event not found - check FollowingEventID');
            break;
          case 2005:
            console.error('❌ Following event precedes preceding event - invalid sequence');
            break;
          case 2006:
            console.log('⚠️ Response already in progress - stopping all retries to prevent cascade');
            // Reset request flag and DO NOT retry immediately to prevent infinite loop
            this.requestInProgress = false;
            // Let the periodic interval handle the next request naturally
            break;
          case 1001:
            console.error('❌ Unknown error - system issue');
            break;
          case 1002:
            console.error('❌ Authentication failed - check credentials');
            break;
          case 1003:
            console.error('❌ Unrecognized request - check API format');
            break;
          default:
            console.error(`❌ Unknown fault code: ${fault.faultCode}`);
        }
      }
      return;
    }

    // Handle CDH Event responses per documentation
    if (message.Event && message.Event.EventClass) {
      console.log(`📱 Received CDH Event - Class: ${message.Event.EventClass}`);

      // Reset request flag since we received a response
      this.requestInProgress = false;

      // Process different event classes
      switch (message.Event.EventClass) {
        case 'DeviceMessage':
          this.processDeviceMessage(message.Event);
          break;
        case 'ReeferMessage':
          this.processReeferMessage(message.Event);
          break;
        case 'LocationMessage':
          this.processLocationMessage(message.Event);
          break;
        default:
          console.log(`📱 Unknown event class: ${message.Event.EventClass}`);
          console.log('📱 Event data:', JSON.stringify(message.Event, null, 2));
      }
      return;
    }

    // Handle bulk event responses (multiple events in one message)
    if (message.Events && Array.isArray(message.Events)) {
      console.log(`📱 Received bulk CDH events: ${message.Events.length} events`);
      this.requestInProgress = false; // Reset flag since we received a response

      // Process all events in the bulk response
      for (const event of message.Events) {
        if (event.EventClass) {
          switch (event.EventClass) {
            case 'DeviceMessage':
              this.processDeviceMessage(event);
              break;
            case 'ReeferMessage':
              this.processReeferMessage(event);
              break;
            case 'LocationMessage':
              this.processLocationMessage(event);
              break;
            default:
              console.log(`📱 Unknown bulk event class: ${event.EventClass}`);
          }
        }
      }
      return;
    }

    // Handle other message types
    if (message.type) {
      switch (message.type) {
        case 'device_data':
          console.log(`📊 Received data for device: ${message.deviceId}`);
          this.processDeviceData(message);
          break;

        case 'error':
          console.error('❌ CDH API error:', message.error);
          break;

        default:
          console.log('📨 Unknown message type:', message.type);
      }
    } else {
      console.log('📨 Unknown message format');
      console.log('Full message:', JSON.stringify(message, null, 2));
    }
  }

  public sendPeriodicRequest(): void {
    if (!this.ws || !this.isConnected) {
      console.log('❌ CDH not connected, skipping periodic request...');
      return;
    }

    if (this.requestInProgress) {
      console.log('⏳ CDH request already in progress, skipping periodic request...');
      return;
    }

    this.requestInProgress = true;

    // Send periodic GetEvents request using correct CDH protocol format
    const getEventsMessage = {
      "GetEvents": {
        "EventType": "all",                    // Required - only valid value per CDH spec
        "EventPartition": 1,                   // Required - integer 1-4
        "PrecedingEventID": "",                // Optional - UUID string (36 chars)
        "FollowingEventID": null,               // Optional - UUID string or null
        "MaxEventCount": 100                   // Optional - integer 1-50,000
      }
    };

    console.log('🔄 Sending periodic CDH GetEvents request...');

    try {
      this.ws.send(JSON.stringify(getEventsMessage));
    } catch (error) {
      console.error('❌ Failed to send periodic CDH request:', error);
      this.requestInProgress = false; // Reset flag on send failure
    }

    // Reset request flag after a delay
    setTimeout(() => {
      this.requestInProgress = false;
    }, 5000); // 5 second timeout
  }

  // Process CDH DeviceMessage events per documentation
  private processDeviceMessage(event: any): void {
    try {
      console.log('📱 Processing CDH DeviceMessage');

      const deviceId = event.DeviceData?.DeviceID || event.DeviceId;
      const assetId = event.DeviceData?.LastAssetID || event.ReeferData?.AssetID;
      const timestamp = event.MessageData?.EventDtm || event.MessageData?.AppDtm || new Date().toISOString();

      // Extract location data
      let location: { latitude: number; longitude: number } | undefined = undefined;
      if (event.DeviceData?.GPSLatitude && event.DeviceData?.GPSLongitude) {
        location = {
          latitude: parseFloat(event.DeviceData.GPSLatitude),
          longitude: parseFloat(event.DeviceData.GPSLongitude)
        };
      }

      // Extract device status data
      const deviceData = {
        deviceId,
        assetId, // This is the container ID
        timestamp,
        location,
        temperature: event.ReeferData?.TAmb || event.DeviceData?.DeviceTemp,
        doorStatus: event.DeviceData?.DoorState,
        powerStatus: event.DeviceData?.ExtPower ? 'on' : 'off',
        batteryLevel: event.DeviceData?.BatteryVoltage,
        errorCodes: event.ReeferData?.ReeferAlarms ?
          event.ReeferData.ReeferAlarms.map((alarm: any) => alarm.RCAlias || `E${alarm.OemAlarm}`) : [],
        rawData: event
      };

      // Process with database integration - pass the full event structure
      this.processEvents([event]);

    } catch (error) {
      console.error('❌ Error processing DeviceMessage:', error);
    }
  }

  // Process CDH ReeferMessage events per documentation
  private processReeferMessage(event: any): void {
    try {
      console.log('📱 Processing CDH ReeferMessage');

      const deviceId = event.AssetID || event.DeviceID || event.DeviceId;
      const timestamp = event.EventUTC || event.EventDtm || new Date().toISOString();

      // Extract location data
      let location: { latitude: number; longitude: number } | undefined = undefined;
      if (event.GPSLatitude && event.GPSLongitude) {
        location = {
          latitude: parseFloat(event.GPSLatitude),
          longitude: parseFloat(event.GPSLongitude)
        };
      }

      // Extract reefer-specific data
      const reeferData = {
        deviceId,
        timestamp,
        location,
        temperature: event.TAmb || event.Temperature,
        doorStatus: event.DoorState || event.DoorStatus,
        powerStatus: event.ExtPower ? 'on' : 'off',
        batteryLevel: event.BatteryVoltage || event.BatteryLevel,
        errorCodes: event.ReeferAlarms ? event.ReeferAlarms.map((alarm: any) => `E${alarm.OemAlarm || alarm.code || alarm}`) : [],
        rawData: event
      };

      this.processEvents([event]);

    } catch (error) {
      console.error('❌ Error processing ReeferMessage:', error);
    }
  }

  // Process CDH LocationMessage events per documentation
  private processLocationMessage(event: any): void {
    try {
      console.log('📱 Processing CDH LocationMessage');

      const deviceId = event.DeviceID || event.DeviceId;
      const timestamp = event.EventUTC || event.EventDtm || new Date().toISOString();

      // Extract location data
      let location: { latitude: number; longitude: number } | undefined = undefined;
      if (event.GPSLatitude && event.GPSLongitude) {
        location = {
          latitude: parseFloat(event.GPSLatitude),
          longitude: parseFloat(event.GPSLongitude)
        };
      }

      const locationData = {
        deviceId,
        timestamp,
        location,
        rawData: event
      };

      this.processEvents([event]);

    } catch (error) {
      console.error('❌ Error processing LocationMessage:', error);
    }
  }

  private processEvents(events: any[]): void {
    console.log(`📡 Processing ${events.length} REAL ORBCOMM events from CDH WebSocket`);
    if (events.length > 0) {
      console.log('📡 Sample REAL event structure:', JSON.stringify(events[0], null, 2));
    }

    const devices = new Map();

    for (const event of events) {
      try {
        // Extract device information from event - handle nested Event structure
        const eventData = event.Event || event;
        const deviceId = eventData.deviceId || eventData.DeviceId || eventData.IMEI ||
          eventData.DeviceData?.DeviceID || eventData.DeviceData?.DeviceId ||
          eventData.MessageData?.DeviceID;
        const assetId = eventData.assetId || eventData.AssetID || eventData.LastAssetID ||
          eventData.ReeferData?.AssetID || eventData.DeviceData?.LastAssetID ||
          eventData.MessageData?.AssetID;

        // Skip processing if no assetId (container ID) is available
        if (!assetId) {
          console.log(`⚠️ Skipping event - no container ID (AssetID) found for device ${deviceId}`);
          continue;
        }

        console.log(`📡 Processing REAL ORBCOMM event - deviceId: ${deviceId}, assetId (container): ${assetId}`);
        const deviceName = eventData.deviceName || eventData.DeviceName || `Device ${deviceId}`;

        // Extract location data from various sources
        let location: { latitude: number; longitude: number } | undefined = undefined;
        const deviceData = eventData.DeviceData || {};

        if (eventData.location) {
          location = {
            latitude: parseFloat(eventData.location.latitude),
            longitude: parseFloat(eventData.location.longitude)
          };
        } else if (eventData.Latitude && eventData.Longitude) {
          location = {
            latitude: parseFloat(eventData.Latitude),
            longitude: parseFloat(eventData.Longitude)
          };
        } else if (deviceData.GPSLatitude && deviceData.GPSLongitude) {
          location = {
            latitude: parseFloat(deviceData.GPSLatitude),
            longitude: parseFloat(deviceData.GPSLongitude)
          };
        }

        // Extract timestamp
        const timestamp = eventData.timestamp || eventData.EventUTC || eventData.Timestamp ||
          eventData.MessageData?.EventDtm || new Date().toISOString();

        if (deviceId) {
          console.log(`📱 Found device: ${deviceId}, processing...`);

          // Extract additional device information from the event structure
          const reeferData = eventData.ReeferData || {};

          // Extract temperature from various sources
          let temperature: number | undefined;
          if (reeferData.TAmb !== undefined) temperature = reeferData.TAmb;
          else if (deviceData.DeviceTemp !== undefined) temperature = deviceData.DeviceTemp;
          else if (eventData.Temperature !== undefined) temperature = eventData.Temperature;

          // Extract door status
          let doorStatus: string | undefined;
          if (deviceData.DoorState) doorStatus = deviceData.DoorState.toLowerCase();
          else if (eventData.DoorState) doorStatus = eventData.DoorState.toLowerCase();

          // Extract power status
          let powerStatus: string | undefined;
          if (deviceData.ExtPower !== undefined) powerStatus = deviceData.ExtPower ? 'on' : 'off';
          else if (eventData.PowerStatus) powerStatus = eventData.PowerStatus.toLowerCase();

          // Extract battery level
          let batteryLevel: number | undefined;
          if (deviceData.BatteryVoltage !== undefined) {
            // Convert voltage to percentage (assuming 8.1V is 100%)
            batteryLevel = Math.min(100, Math.max(0, (deviceData.BatteryVoltage / 8.1) * 100));
          }

          // Extract error codes/alarms
          const errorCodes: string[] = [];
          if (reeferData.ReeferAlarms && Array.isArray(reeferData.ReeferAlarms)) {
            reeferData.ReeferAlarms.forEach((alarm: any) => {
              if (alarm.Active) {
                errorCodes.push(alarm.RCAlias || `E${alarm.OemAlarm}`);
              }
            });
          }

          // Extract asset ID for container matching
          const lastAssetId = deviceData.LastAssetID || assetId;

          const deviceInfo = {
            deviceId,
            deviceName,
            assetId: lastAssetId,
            status: 'active',
            lastSeen: timestamp,
            lastUpdate: timestamp,
            location,
            temperature,
            doorStatus,
            powerStatus,
            batteryLevel,
            errorCodes,
            rawEvent: eventData,
            deviceData,
            reeferData
          };

          devices.set(deviceId, deviceInfo);
          console.log(`📱 Added device to map: ${deviceId}`, deviceInfo);

          // Emit realtime broadcast for location updates
          if (location) {
            try {
              (global as any).broadcast?.({
                type: 'device_update',
                data: {
                  deviceId,
                  lat: location.latitude,
                  lng: location.longitude,
                  status: 'active',
                  ts: Date.now()
                }
              });
            } catch (err) {
              console.error('Error broadcasting device update:', err);
            }
          }

          // Detect anomalies and raise alerts in background
          try {
            const dataLike = {
              deviceId,
              timestamp,
              location: location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
              temperature: event.Temperature || event.temperature,
              doorStatus: event.DoorStatus || event.doorStatus,
              powerStatus: event.PowerStatus || event.powerStatus,
              batteryLevel: event.BatteryLevel || event.batteryLevel,
              errorCodes: Array.isArray(event.ReeferAlarms)
                ? (event.ReeferAlarms.map((a: any) => `E${a.OemAlarm || a.code || a}`))
                : (event.errorCodes || [])
            } as any;

            // Use assetId as primary container identifier (AssetID = container ID)
            const lastAssetId = assetId || event.AssetID || event.LastAssetID;

            // Only process events where we have a container ID (assetId)
            if (!lastAssetId) {
              console.log(`⚠️ Skipping anomaly detection - no container ID (AssetID) available for device ${deviceId}`);
              return;
            }

            console.log(`🔍 Checking for container with exact ID match: ${lastAssetId}`);

            const anomalies = detectAnomalies(dataLike as any);
            if (anomalies && anomalies.length > 0) {
              // Fire and forget to avoid blocking event loop
              (async () => {
                try {
                  const { storage } = await import('../storage');

                  // Strict matching: only process if container ID exactly matches
                  const container = await storage.getContainerByCode(lastAssetId);

                  if (!container) {
                    console.log(`❌ No container found with exact container ID ${lastAssetId} - skipping ORBCOMM alert creation for device ${deviceId}`);
                    console.log(`📋 Available container IDs in database:`, (await storage.getAllContainers()).map(c => c.containerCode));
                    return;
                  }

                  console.log(`✅ Container match found: ${container.containerCode} (ID: ${container.id}) - creating REAL ORBCOMM alert`);

                  // Update container telemetry with full Orbcomm data using enhanced method
                  const rawTemp = event.Temperature || event.temperature;
                  await storage.updateContainerTelemetry(container.id, {
                    lastAssetId: lastAssetId || deviceId,
                    timestamp,
                    latitude: location?.latitude,
                    longitude: location?.longitude,
                    temperature: rawTemp !== undefined ? Math.round(rawTemp) : undefined,
                    rawData: event // Store complete raw Orbcomm event as JSONB
                  });

                  // Check for existing alerts to prevent duplicates
                  const existingAlerts = await storage.getAlertsByContainer(container.id);
                  const alertCode = `ORBCOMM-${anomalies.join('-')}`;
                  const hasRecentAlert = existingAlerts.some(a =>
                    a.alertCode === alertCode &&
                    (a as any).status === 'open' &&
                    new Date(a.detectedAt).getTime() > (Date.now() - 10 * 60 * 1000) // 10 minutes deduplication window
                  );

                  if (hasRecentAlert) {
                    console.log(`📱 Skipping duplicate ORBCOMM alert for ${deviceId}: ${anomalies.join(', ')}`);
                    return;
                  }

                  const title = `Device ${deviceId} anomalies: ${anomalies.join(', ')}`;
                  const alert = await storage.createAlert({
                    alertCode,
                    containerId: container.id,
                    alertType: 'error', // Required field
                    severity: anomalies.includes('POWER_FAILURE') || anomalies.includes('TEMPERATURE_ANOMALY') ? 'high' : 'medium',
                    source: 'orbcomm', // Required field
                    title,
                    description: `Automated anomaly detection from Orbcomm events at ${new Date(timestamp).toISOString()}`,
                    detectedAt: new Date(),
                    metadata: event // Store raw Orbcomm event data
                  });

                  try {
                    (global as any).broadcast?.({ type: 'alert_created', data: alert });
                  } catch { }
                } catch (e) {
                  console.error('Error creating alert from Orbcomm anomaly:', e);
                }
              })();
            } else if (lastAssetId) {
              // Even without anomalies, update container telemetry if we have container ID
              (async () => {
                try {
                  const { storage } = await import('../storage');

                  // Strict matching: only update telemetry for containers that exactly match
                  const container = await storage.getContainerByCode(lastAssetId);

                  if (container) {
                    console.log(`✅ Container match found: ${container.containerCode} (ID: ${container.id}) - updating telemetry with REAL ORBCOMM data`);

                    const rawTemp = event.Temperature || event.temperature;
                    await storage.updateContainerTelemetry(container.id, {
                      lastAssetId: lastAssetId,
                      timestamp,
                      latitude: location?.latitude,
                      longitude: location?.longitude,
                      temperature: rawTemp !== undefined ? Math.round(rawTemp) : undefined,
                      rawData: event // Store complete raw Orbcomm event as JSONB
                    });

                    console.log(`📍 Updated telemetry for container ${container.containerCode} from AssetID ${lastAssetId}`);
                  } else {
                    console.log(`❌ No container found with exact container ID ${lastAssetId} - skipping ORBCOMM telemetry update for device ${deviceId}`);
                  }
                } catch (e) {
                  console.error('Error updating container telemetry:', e);
                }
              })();
            }
          } catch (e) {
            console.error('Error during anomaly detection:', e);
          }
        }
      } catch (err) {
        console.error('Error processing event:', err, event);
      }
    }

    // Persist associations and DB locations based on latest events
    try { this.updateContainersFromDevices(); } catch { }

    // Store processed devices
    this.devices = Array.from(devices.values());
    console.log(`✅ Processed ${this.devices.length} unique devices from events`);
    console.log(`📱 Device IDs:`, this.devices.map(d => d.deviceId));

    // Update database with device information
    this.updateContainersFromDevices();
  }

  private async updateContainersFromDevices(): Promise<void> {
    try {
      const { storage } = await import('../storage');

      for (const device of this.devices) {
        if (!device.deviceId) continue;

        // Extract lastAssetId from raw event for primary container matching
        let lastAssetId: string | null = null;
        if ((device as any).rawEvent) {
          const raw = (device as any).rawEvent;
          const evt = raw.Event || {};
          const dd = evt.DeviceData || {};
          const rd = evt.ReeferData || {};

          // Extract AssetID from various possible locations
          lastAssetId = dd.LastAssetID || rd.AssetID || rd.LastAssetID;
        }

        // Only process if we have a container ID (AssetID)
        if (!lastAssetId) {
          console.log(`⚠️ Skipping container update for device ${device.deviceId} - no container ID (AssetID) available`);
          continue;
        }

        // Strict matching: only update containers that exactly match the container ID
        const container = await storage.getContainerByCode(lastAssetId);

        if (container) {
          // Update orbcommDeviceId association if not set
          if (!container.orbcommDeviceId) {
            try {
              await storage.updateContainer(container.id, {
                orbcommDeviceId: device.deviceId,
                updatedAt: new Date()
              });
              console.log(`✅ Associated container ${lastAssetId} with Orbcomm device ${device.deviceId}`);
            } catch (err) {
              console.error(`❌ Failed to associate container ${lastAssetId} with device ${device.deviceId}:`, err);
            }
          }

          // Construct normalized telemetry object for frontend display
          const telemetryData = {
            temperature: device.temperature !== undefined ? Math.round(device.temperature) : undefined,
            doorStatus: device.doorStatus,
            powerStatus: device.powerStatus,
            batteryLevel: device.batteryLevel,
            location: device.location,
            latitude: device.location?.latitude,
            longitude: device.location?.longitude,
            timestamp: device.lastSeen || new Date().toISOString(),
            errorCodes: device.errorCodes,
            rawEvent: (device as any).rawEvent // Keep raw event nested if needed
          };

          // Update container with telemetry data using enhanced method
          await storage.updateContainerTelemetry(container.id, {
            lastAssetId: lastAssetId,
            timestamp: device.lastSeen || new Date().toISOString(),
            latitude: device.location?.latitude,
            longitude: device.location?.longitude,
            rawData: telemetryData // Store normalized data as lastTelemetry
          });

          console.log(`📍 Updated telemetry for container ${container.containerCode} from device ${device.deviceId} (AssetID: ${lastAssetId})`);

          // Broadcast after successful DB write to keep UI in sync
          try {
            if (device.location) {
              (global as any).broadcast?.({
                type: 'device_update',
                data: {
                  deviceId: device.deviceId,
                  lat: device.location.latitude,
                  lng: device.location.longitude,
                  status: 'active',
                  ts: Date.now()
                }
              });
              (global as any).broadcast?.({
                type: 'container_location_update',
                data: {
                  containerId: container.id,
                  lat: device.location.latitude,
                  lng: device.location.longitude,
                  ts: Date.now(),
                  source: 'orbcomm'
                }
              });
            }

            // Broadcast full telemetry update for real-time status on frontend
            (global as any).broadcast?.({
              type: 'container_update',
              data: {
                containerId: container.id,
                temperature: device.temperature,
                doorStatus: device.doorStatus,
                powerStatus: device.powerStatus,
                batteryLevel: device.batteryLevel,
                latitude: device.location?.latitude,
                longitude: device.location?.longitude,
                timestamp: device.lastSeen || new Date().toISOString(),
                deviceId: device.deviceId,
                source: 'orbcomm'
              }
            });
          } catch { }
        } else {
          console.log(`⚠️ No container found with exact container ID ${lastAssetId} for Orbcomm device ${device.deviceId}`);
        }
      }
    } catch (error) {
      console.error('Error updating containers from devices:', error);
    }
  }

  private processDeviceList(devices: any[]): void {
    console.log(`📱 Processing ${devices.length} devices from Orbcomm`);

    // Store devices for later use
    this.devices = devices.map(device => ({
      deviceId: device.deviceId || device.id || device.imei,
      deviceName: device.name || device.deviceName || `Device ${device.deviceId}`,
      status: device.status || 'active',
      lastSeen: device.lastSeen || device.lastUpdate,
      location: device.location ? {
        latitude: parseFloat(device.location.lat || device.location.latitude),
        longitude: parseFloat(device.location.lng || device.location.longitude)
      } : undefined
    }));

    console.log('✅ Device list processed and stored');
  }

  private processDeviceData(data: any): void {
    console.log(`📊 Processing device data for ${data.deviceId}`);

    // Store device data for later retrieval
    this.deviceData[data.deviceId] = {
      deviceId: data.deviceId,
      timestamp: data.timestamp || new Date().toISOString(),
      location: data.location ? {
        latitude: parseFloat(data.location.lat || data.location.latitude),
        longitude: parseFloat(data.location.lng || data.location.longitude)
      } : undefined,
      temperature: data.temperature,
      doorStatus: data.doorStatus || data.door_status,
      powerStatus: data.powerStatus || data.power_status,
      batteryLevel: data.batteryLevel || data.battery_level,
      errorCodes: data.errorCodes || data.error_codes || [],
      rawData: data
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect to CDH (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('❌ CDH reconnection failed:', error);
        });
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached for CDH API');
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this._isConnected = false;
    }
  }

  async sendCommand(command: any): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to CDH API');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('CDH command timeout'));
      }, 10000); // 10 second timeout

      const messageHandler = (data: any) => {
        try {
          const response = JSON.parse(data.toString());
          clearTimeout(timeout);
          this.ws?.off('message', messageHandler);
          resolve(response);
        } catch (error) {
          clearTimeout(timeout);
          this.ws?.off('message', messageHandler);
          reject(error);
        }
      };

      this.ws?.on('message', messageHandler);
      this.ws?.send(JSON.stringify(command));
    });
  }

  // Get all devices (read-only) - returns ONLY devices with real ORBCOMM telemetry data
  async getAllDevices(): Promise<OrbcommDevice[]> {
    console.log(`📱 getAllDevices called - CDH connected: ${this.isConnected}, cached devices: ${this.devices.length}`);

    if (!this.isConnected) {
      console.log('⚠️ CDH not connected, returning empty array (no fallback)');
      return [];
    }

    // Filter to only return devices that have real ORBCOMM telemetry data
    const realOrbcommDevices = this.devices.filter(device => {
      // Check if device has real telemetry data (not fallback)
      const hasRealData = device.rawEvent &&
        !device.rawEvent.fallback;
      return hasRealData;
    });

    console.log(`📱 Returning ${realOrbcommDevices.length} devices with real ORBCOMM telemetry data`);
    return realOrbcommDevices;
  }

  // Create fallback devices from database containers
  // Use containerCode as deviceId since ORBCOMM typically uses asset IDs as device identifiers
  private async createFallbackDevices(): Promise<void> {
    try {
      const { storage } = await import('../storage');
      const containers = await storage.getAllContainers();

      console.log(`📱 Creating devices from ${containers.length} database containers...`);

      const fallbackDevices: OrbcommDevice[] = [];

      for (const container of containers) {
        // Use containerCode as the ORBCOMM device ID (typical ORBCOMM setup)
        // Also check if there's an explicit orbcommDeviceId
        const deviceId = container.orbcommDeviceId || container.containerCode;

        if (deviceId) {
          const device: OrbcommDevice = {
            deviceId,
            deviceName: `${container.containerCode}`,
            status: container.status === 'active' ? 'active' : 'inactive',
            lastSeen: container.lastSyncTime || new Date().toISOString(),
          };

          fallbackDevices.push(device);
        }
      }

      this.devices = fallbackDevices;
      console.log(`📱 Created ${this.devices.length} fallback devices from database containers`);
    } catch (error) {
      console.error('❌ Error creating fallback devices:', error);
      // Create minimal fallback devices
      this.devices = [
        {
          deviceId: 'QUAD622180045',
          deviceName: 'Device QUAD622180045',
          status: 'active',
          lastSeen: new Date().toISOString(),
        },
        {
          deviceId: 'QUAD622340186',
          deviceName: 'Device QUAD622340186',
          status: 'active',
          lastSeen: new Date().toISOString(),
        }
      ];
      console.log(`📱 Created ${this.devices.length} minimal fallback devices`);
    }
  }

  // Get device data (read-only) - returns ONLY data for devices with real ORBCOMM telemetry
  async getDeviceData(deviceId: string): Promise<OrbcommDeviceData | null> {
    console.log(`📱 getDeviceData called for device: ${deviceId}`);

    if (!this.isConnected) {
      console.log('⚠️ CDH not connected, returning null');
      return null;
    }

    // Return cached data if available and has real telemetry
    if (this.deviceData[deviceId]) {
      const data = this.deviceData[deviceId];
      // Check if this is real ORBCOMM data (not fallback)
      if (data.rawData && !data.rawData.fallback) {
        console.log(`📱 Returning cached real ORBCOMM data for device: ${deviceId}`);
        return data;
      }
    }

    // Try to find device in the devices array and create data from it
    const device = this.devices.find(d => d.deviceId === deviceId);
    if (device && device.rawEvent && !device.rawEvent.fallback) {
      console.log(`📱 Creating device data from real ORBCOMM device: ${deviceId}`);
      const deviceData: OrbcommDeviceData = {
        deviceId: device.deviceId,
        assetId: (device as any).assetId || device.deviceId,
        timestamp: (device as any).lastUpdate || new Date().toISOString(),
        location: (device as any).location,
        temperature: (device as any).temperature,
        doorStatus: (device as any).doorStatus,
        powerStatus: (device as any).powerStatus,
        batteryLevel: (device as any).batteryLevel,
        errorCodes: (device as any).errorCodes || [],
        rawData: (device as any).rawEvent || (device as any).rawData
      };

      // Cache the data for future requests
      this.deviceData[deviceId] = deviceData;
      return deviceData;
    }

    console.log(`⚠️ No real ORBCOMM data found for device: ${deviceId}`);
    return null;
  }

  private requestDeviceData(deviceId: string): void {
    if (!this.ws || !this.isConnected) return;

    const requestMessage = {
      type: 'get_device_data',
      deviceId: deviceId,
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`
    };

    console.log(`📊 Requesting data for device ${deviceId}...`);
    this.ws.send(JSON.stringify(requestMessage));
  }

  // Get device location history (read-only)
  async getDeviceLocationHistory(deviceId: string, hours: number = 24): Promise<any[]> {
    try {
      const response = await this.sendCommand({
        command: 'get_location_history',
        deviceId: deviceId,
        hours: hours,
        timestamp: new Date().toISOString()
      });

      return response.history || [];
    } catch (error) {
      console.error(`❌ Error fetching location history for device ${deviceId}:`, error);
      return [];
    }
  }

  // Get device alerts (read-only)
  async getDeviceAlerts(deviceId: string): Promise<any[]> {
    try {
      const response = await this.sendCommand({
        command: 'get_device_alerts',
        deviceId: deviceId,
        timestamp: new Date().toISOString()
      });

      return response.alerts || [];
    } catch (error) {
      console.error(`❌ Error fetching alerts for device ${deviceId}:`, error);
      return [];
    }
  }
}

// Manually associate containers with Orbcomm devices using the correct mapping
export async function associateContainersWithOrbcomm(): Promise<void> {
  try {
    console.log('🔄 Starting manual container-Orbcomm association...');
    const devices = await getOrbcommClient().getAllDevices();

    if (devices.length === 0) {
      console.log('⚠️ No Orbcomm devices available for association');
      return;
    }

    const { storage } = await import('../storage');

    for (const device of devices) {
      try {
        if ((device as any).rawEvent) {
          const raw = (device as any).rawEvent;
          const evt = raw.Event || {};
          const dd = evt.DeviceData || {};
          const rd = evt.ReeferData || {};
          const assetId = dd.LastAssetID || rd.AssetID;

          if (assetId) {
            // Try to find container by AssetID as containerCode
            let container = await storage.getContainerByCode(assetId);

            if (container && !container.orbcommDeviceId) {
              // Associate the container with the device
              await storage.updateContainer(container.id, {
                orbcommDeviceId: device.deviceId,
                updatedAt: new Date()
              });
              console.log(`✅ Associated container ${assetId} with Orbcomm device ${device.deviceId}`);
            } else if (!container) {
              console.log(`⚠️ No container found with code ${assetId} for device ${device.deviceId}`);
            } else {
              console.log(`ℹ️ Container ${assetId} already associated with device ${container.orbcommDeviceId}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error associating device ${device.deviceId}:`, error);
      }
    }

    console.log('🎉 Manual association completed');
  } catch (error) {
    console.error('❌ Error during manual association:', error);
  }
}

// Create singleton instance
let orbcommClient: OrbcommAPIClient | null = null;

export function getOrbcommClient(): OrbcommAPIClient {
  if (!orbcommClient) {
    // Prioritize Production URL
    const possibleUrls = [
      process.env.ORBCOMM_URL,
      'wss://wamc.wamcentral.net:44355/cdh',   // Production server
      'wss://integ.tms-orbcomm.com:44355/cdh', // Integration server (fallback)
    ].filter(Boolean);

    const url = possibleUrls[0] || 'wss://wamc.wamcentral.net:44355/cdh';
    const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
    const password = process.env.ORBCOMM_PASSWORD || 'P4pD#QU@!D@re'; // Production password

    console.log(`🔧 Using CDH URL: ${url}`);
    console.log(`🔧 Using username: ${username}`);

    orbcommClient = new OrbcommAPIClient(url, username, password);
  }
  return orbcommClient;
}

// Initialize CDH connection with fallback URLs
export async function initializeOrbcommConnection(): Promise<void> {
  const possibleUrls = [
    process.env.ORBCOMM_URL,
    'wss://wamc.wamcentral.net:44355/cdh',   // Production server
    'wss://integ.tms-orbcomm.com:44355/cdh', // Integration server
  ].filter(Boolean);

  const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
  const password = process.env.ORBCOMM_PASSWORD || 'P4pD#QU@!D@re';

  for (const url of possibleUrls) {
    try {
      console.log(`🔌 Attempting CDH connection to: ${url}`);
      const client = new OrbcommAPIClient(url!, username, password);
      await client.connect();

      // Update the singleton instance
      orbcommClient = client;
      console.log(`🚀 CDH API initialized successfully with ${url}`);
      return;

    } catch (error) {
      console.error(`❌ Failed to connect to ${url}:`, (error as any).message);
      continue;
    }
  }

  console.error('❌ Failed to initialize CDH API with any URL. Continuing with mock data.');
  // Don't throw error, continue with mock data
}

// Fetch data for a specific device
export async function fetchOrbcommDeviceData(deviceId: string): Promise<OrbcommDeviceData> {
  try {
    const client = getOrbcommClient();

    if (!(client as any).isConnected) {
      console.log('⚠️ CDH not connected, using mock data');
      return await fetchMockDeviceData(deviceId);
    }

    const data = await client.getDeviceData(deviceId);

    if (data) {
      return data;
    } else {
      console.log('⚠️ No data from CDH, using mock data');
      return await fetchMockDeviceData(deviceId);
    }
  } catch (error) {
    console.error(`❌ Error fetching CDH data for ${deviceId}:`, error);
    return await fetchMockDeviceData(deviceId);
  }
}

// Fetch data for all devices
export async function fetchAllDevicesData(deviceIds: string[]): Promise<OrbcommDeviceData[]> {
  const promises = deviceIds.map((id) => fetchOrbcommDeviceData(id));
  return Promise.all(promises);
}

// Mock data fallback
async function fetchMockDeviceData(deviceId: string): Promise<OrbcommDeviceData> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const MOCK_LOCATIONS = [
    { lat: 33.7434, lng: -118.2726, name: "LA Port" },
    { lat: 32.7157, lng: -117.1611, name: "San Diego" },
    { lat: 37.8044, lng: -122.2712, name: "Oakland" },
    { lat: 33.7701, lng: -118.1937, name: "Long Beach" },
    { lat: 37.7749, lng: -122.4194, name: "San Francisco" },
  ];

  const location = MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)];
  const hasError = Math.random() < 0.15; // 15% chance of error

  return {
    deviceId,
    timestamp: new Date().toISOString(),
    location: {
      latitude: location.lat + (Math.random() - 0.5) * 0.01,
      longitude: location.lng + (Math.random() - 0.5) * 0.01,
    },
    temperature: Math.floor(Math.random() * 30) - 10, // -10 to 20°C
    doorStatus: Math.random() > 0.95 ? "open" : "closed",
    powerStatus: Math.random() > 0.98 ? "off" : "on",
    batteryLevel: Math.floor(Math.random() * 40) + 60, // 60-100%
    errorCodes: hasError ? [`ERR_${Math.floor(Math.random() * 1000)}`] : [],
  };
}

// Populate database with actual CDH devices
export async function populateOrbcommDevices(): Promise<void> {
  try {
    const client = getOrbcommClient();

    console.log('📱 Fetching actual devices from CDH...');
    const devices = await client.getAllDevices();
    console.log(`📱 Found ${devices.length} actual devices from CDH`);

    if (devices.length === 0) {
      console.log('⚠️ No devices received from CDH, using fallback data');
      return;
    }

    // Import storage to create containers
    const { storage } = await import('../storage');

    for (const device of devices) {
      try {
        // Extract AssetID from device data if available
        let containerCode = device.deviceId; // fallback
        let orbcommDeviceId = device.deviceId;

        if ((device as any).rawEvent) {
          try {
            const raw = (device as any).rawEvent;
            const evt = raw.Event || {};
            const dd = evt.DeviceData || {};
            const rd = evt.ReeferData || {};
            const assetId = dd.LastAssetID || rd.AssetID;
            if (assetId) {
              containerCode = assetId; // AssetID/LastAssetID is the containerCode
              orbcommDeviceId = device.deviceId; // DeviceID is the orbcommDeviceId
            }
          } catch { }
        }

        // Check if container already exists
        const existingContainer = await storage.getContainerByCode(containerCode);

        if (!existingContainer) {
          // Create new container with actual CDH data
          await storage.createContainer({
            containerCode: containerCode,
            orbcommDeviceId: orbcommDeviceId,
            currentLocation: device.location ? {
              lat: device.location.latitude,
              lng: device.location.longitude
            } : null,
            capacity: "Standard", // Default capacity
            createdAt: new Date(),
            updatedAt: new Date()
          });

          console.log(`✅ Created container ${containerCode} for actual CDH device ${orbcommDeviceId} (AssetID: ${containerCode})`);
        } else {
          // Update existing container with actual CDH data
          await storage.updateContainer(existingContainer.id, {
            orbcommDeviceId: orbcommDeviceId,
            currentLocation: device.location ? {
              lat: device.location.latitude,
              lng: device.location.longitude
            } : existingContainer.currentLocation,
            updatedAt: new Date()
          });

          console.log(`✅ Updated container ${containerCode} with CDH device ${orbcommDeviceId}`);
        }

        // Fetch and store device data
        const deviceData = await client.getDeviceData(device.deviceId);
        if (deviceData) {
          console.log(`📊 Stored actual data for device ${orbcommDeviceId}:`, {
            location: deviceData.location,
            temperature: deviceData.temperature,
            batteryLevel: deviceData.batteryLevel,
            errorCodes: deviceData.errorCodes
          });
        }

      } catch (error) {
        console.error(`❌ Error processing actual CDH device ${device.deviceId}:`, error);
      }
    }

    console.log('🎉 Actual CDH device population completed');
  } catch (error) {
    console.error('❌ Error populating actual CDH devices:', error);
  }
}

// Test CDH connection with detailed logging
export async function testCDHConnection(): Promise<void> {
  try {
    console.log('🧪 Testing CDH connection...');

    const url = process.env.ORBCOMM_URL || 'wss://wamc.wamcentral.net:44355/cdh';
    const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
    const password = process.env.ORBCOMM_PASSWORD || 'P4cD#QA@!D@re'; // Exact password from ORBCOMM support

    console.log('📋 Connection parameters:');
    console.log(`  URL: ${url}`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password ? '***' : 'NOT SET'}`);

    // Test basic connectivity
    const WebSocket = require('ws');
    const testWs = new WebSocket(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        'User-Agent': 'ContainerGenie-Test/1.0'
      },
      handshakeTimeout: 10000,
      perMessageDeflate: false,
      rejectUnauthorized: false
    });

    testWs.on('open', () => {
      console.log('✅ Test connection successful!');
      testWs.close();
    });

    testWs.on('error', (error: any) => {
      console.error('❌ Test connection failed:', error);
      console.error('❌ This might indicate:');
      console.error('  - Incorrect URL or port');
      console.error('  - Authentication failure');
      console.error('  - Network connectivity issues');
      console.error('  - Server not accepting connections');
    });

    testWs.on('close', (code: number, reason: string) => {
      console.log(`🔌 Test connection closed. Code: ${code}, Reason: ${reason}`);
    });

  } catch (error) {
    console.error('❌ Error during CDH connection test:', error);
  }
}

// Detect anomalies in device data
export function detectAnomalies(data: OrbcommDeviceData): string[] {
  const anomalies: string[] = [];

  if (data.powerStatus === "off") {
    anomalies.push("POWER_FAILURE");
  }

  if (data.batteryLevel && data.batteryLevel < 20) {
    anomalies.push("LOW_BATTERY");
  }

  if (data.temperature && (data.temperature < -20 || data.temperature > 30)) {
    anomalies.push("TEMPERATURE_ANOMALY");
  }

  if (data.doorStatus === "open") {
    anomalies.push("DOOR_OPEN_ALERT");
  }

  if (data.errorCodes && data.errorCodes.length > 0) {
    anomalies.push(...data.errorCodes);
  }

  return anomalies;
}
