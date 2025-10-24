// Real Orbcomm API integration
import WebSocket from 'ws';

export interface OrbcommDeviceData {
  deviceId: string;
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
}

class OrbcommAPIClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private devices: OrbcommDevice[] = [];
  private deviceData: { [deviceId: string]: OrbcommDeviceData } = {};

  constructor(
    private url: string,
    private username: string,
    private password: string
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to Orbcomm CDH API...');
        console.log(`📍 URL: ${this.url}`);
        console.log(`👤 Username: ${this.username}`);
        
        // Create WebSocket connection with proper headers and required subprotocol
        // Important: Orbcomm expects the subprotocol 'cdh.orbcomm.com'
        this.ws = new WebSocket(
          this.url,
          'cdh.orbcomm.com',
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
              'User-Agent': 'ContainerGenie/1.0',
              'Origin': 'https://container-genie.com'
            }
          }
        );

        this.ws.on('open', () => {
          console.log('✅ Connected to Orbcomm CDH API');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send authentication message after connection
          this.sendAuthMessage();
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('❌ Orbcomm WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 Orbcomm WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
          this.isConnected = false;
          this.handleReconnect();
        });

        this.ws.on('message', (data) => {
          try {
            const raw = data.toString();
            // Sanitize control characters which break JSON.parse
            const cleaned = raw.replace(/[\u0000-\u001F]+/g, ' ');
            const message = JSON.parse(cleaned);
            console.log('📨 Received Orbcomm message:', JSON.stringify(message, null, 2));
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing Orbcomm message:', error);
            console.log('Raw message:', data.toString());
            // If message looks like a faults envelope, ignore without crashing
          }
        });

      } catch (error) {
        console.error('❌ Error creating Orbcomm WebSocket:', error);
        reject(error);
      }
    });
  }

  private sendAuthMessage(): void {
    if (!this.ws || !this.isConnected) return;
    
    // GetEvents message with authentication - using correct CDH protocol format
    const getEventsMessage = {
      "GetEvents": {
        "EventType": "all",
        "EventPartition": 1,
        "PrecedingEventID": "",
        "FollowingEventID": null,
        "MaxEventCount": 5000
      }
    };
    
    console.log('🔐 Sending authentication message...');
    this.ws.send(JSON.stringify(getEventsMessage));
  }

  private handleMessage(message: any): void {
    console.log('📨 Processing Orbcomm message:', message);
    
    // Handle CDH response format
    if (message.faults && Array.isArray(message.faults)) {
      // Handle faults - don't treat as errors, just log
      console.log('⚠️ Orbcomm faults received:', message.faults.length);
      return;
    }
    
    if (message.GetEventsResponse) {
      console.log('✅ GetEvents response received');
      const response = message.GetEventsResponse;
      
      if (response.Events && Array.isArray(response.Events)) {
        console.log(`📱 Processing ${response.Events.length} events from Orbcomm`);
        this.processEvents(response.Events);
      } else {
        console.log('📱 No events in response');
      }
      
      // Set up periodic refresh
      setTimeout(() => {
        this.sendPeriodicRequest();
      }, 30000); // Refresh every 30 seconds
      
      return;
    }
    
    // Handle Orbcomm live stream format: { Sequence, Event: { DeviceData, ReeferData, MessageData } }
    if (message.Event && (message.Event.DeviceData || message.Event.ReeferData)) {
      try {
        const evt = message.Event;
        const dd = evt.DeviceData || {};
        const rd = evt.ReeferData || {};
        const deviceId = dd.DeviceID || rd.AssetID || rd.DeviceID;
        const lat = dd.GPSLatitude ?? rd.GPSLatitude;
        const lng = dd.GPSLongitude ?? rd.GPSLongitude;
        const ts = (evt.MessageData && (evt.MessageData.EventDtm || evt.MessageData.AppDtm)) || dd.DeviceDataDtm || rd.ReeferDataDtm || new Date().toISOString();

        // Convert to a simple event shape our pipeline understands
        const normalized: any = {
          DeviceId: deviceId,
          DeviceName: deviceId,
          EventUTC: ts,
          Latitude: lat,
          Longitude: lng,
          Location: (lat != null && lng != null) ? { Latitude: String(lat), Longitude: String(lng) } : undefined,
          DoorStatus: dd.DoorState,
          PowerStatus: dd.ExtPower ? 'on' : 'off',
          Temperature: rd.TAmb ?? dd.DeviceTemp,
          BatteryLevel: dd.BatteryVoltage,
          ReeferAlarms: rd.ReeferAlarms
        };

        this.processEvents([normalized]);
        return;
      } catch (e) {
        console.error('❌ Error normalizing Orbcomm Event format:', e);
      }
    }

    // Handle other message types
    if (message.type) {
      switch (message.type) {
        case 'device_data':
          console.log(`📊 Received data for device: ${message.deviceId}`);
          this.processDeviceData(message);
          break;
          
        case 'error':
          console.error('❌ Orbcomm API error:', message.error);
          break;
          
        default:
          console.log('📨 Unknown message type:', message.type);
      }
    } else {
      console.log('📨 Unknown message format');
      console.log('Full message:', JSON.stringify(message, null, 2));
    }
  }

  private sendPeriodicRequest(): void {
    if (!this.ws || !this.isConnected) return;
    
    // Send periodic GetEvents request for real-time updates
    const getEventsMessage = {
      "GetEvents": {
        "EventType": "all",
        "EventPartition": 1,
        "PrecedingEventID": "",
        "FollowingEventID": null,
        "MaxEventCount": 100
      }
    };
    
    console.log('🔄 Sending periodic GetEvents request...');
    this.ws.send(JSON.stringify(getEventsMessage));
  }

  private processEvents(events: any[]): void {
    console.log(`📱 Processing ${events.length} events from Orbcomm`);
    
    const devices = new Map();
    
    for (const event of events) {
      try {
        // Extract device information from event
        const deviceId = event.DeviceId || event.deviceId || event.IMEI;
        const deviceName = event.DeviceName || event.deviceName || `Device ${deviceId}`;
        
        // Extract location data
        let location: { latitude: number; longitude: number } | undefined = undefined;
        if (event.Latitude && event.Longitude) {
          location = {
            latitude: parseFloat(event.Latitude),
            longitude: parseFloat(event.Longitude)
          };
        } else if (event.Location) {
          location = {
            latitude: parseFloat(event.Location.Latitude || event.Location.lat),
            longitude: parseFloat(event.Location.Longitude || event.Location.lng)
          };
        }
        
        // Extract timestamp
        const timestamp = event.EventUTC || event.Timestamp || event.timestamp || new Date().toISOString();
        
        if (deviceId) {
          devices.set(deviceId, {
            deviceId,
            deviceName,
            status: 'active',
            lastSeen: timestamp,
            location,
            rawEvent: event
          });
          
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

            // Extract lastAssetId for container matching (AssetID = container ID)
            let lastAssetId: string | null = null;
            if (event.ReeferAlarms && Array.isArray(event.ReeferAlarms) && event.ReeferAlarms.length > 0) {
              // Extract from ReeferAlarms if available
              lastAssetId = event.ReeferAlarms[0]?.AssetID || event.ReeferAlarms[0]?.assetId;
            }
            if (!lastAssetId && event.AssetID) {
              lastAssetId = event.AssetID;
            }
            if (!lastAssetId && event.LastAssetID) {
              lastAssetId = event.LastAssetID;
            }

            const anomalies = detectAnomalies(dataLike as any);
            if (anomalies && anomalies.length > 0) {
              // Fire and forget to avoid blocking event loop
              (async () => {
                try {
                  const { storage } = await import('../storage');

                  let container = null;
                  if (lastAssetId) {
                    // Primary lookup: container_id matches lastAssetId (container ID = reefer ID)
                    container = await storage.getContainerByCode(lastAssetId);
                  }

                  if (!container && deviceId) {
                    // Fallback: try orbcomm device ID
                    container = await storage.getContainerByOrbcommId(deviceId);
                  }

                  if (!container) {
                    console.log(`⚠️ No container match found for lastAssetId ${lastAssetId} or deviceId ${deviceId}`);
                    return;
                  }

                  // Update container telemetry with full Orbcomm data using enhanced method
                  await storage.updateContainerTelemetry(container.id, {
                    lastAssetId: lastAssetId || deviceId,
                    timestamp,
                    latitude: location?.latitude,
                    longitude: location?.longitude,
                    temperature: event.Temperature || event.temperature,
                    rawData: event // Store complete raw Orbcomm event as JSONB
                  });

                  const title = `Device ${deviceId} anomalies: ${anomalies.join(', ')}`;
                  const alert = await storage.createAlert({
                    alertCode: `ALT-${Date.now()}`,
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
                  } catch {}
                } catch (e) {
                  console.error('Error creating alert from Orbcomm anomaly:', e);
                }
              })();
            } else if (lastAssetId || deviceId) {
              // Even without anomalies, update container telemetry if we have identification
              (async () => {
                try {
                  const { storage } = await import('../storage');

                  let container = null;
                  if (lastAssetId) {
                    container = await storage.getContainerByCode(lastAssetId);
                  }
                  if (!container && deviceId) {
                    container = await storage.getContainerByOrbcommId(deviceId);
                  }

                  if (container) {
                    await storage.updateContainerTelemetry(container.id, {
                      lastAssetId: lastAssetId || deviceId,
                      timestamp,
                      latitude: location?.latitude,
                      longitude: location?.longitude,
                      temperature: event.Temperature || event.temperature,
                      rawData: event // Store complete raw Orbcomm event as JSONB
                    });

                    console.log(`📍 Updated telemetry for container ${container.containerCode} from ${lastAssetId ? 'AssetID' : 'DeviceID'} ${lastAssetId || deviceId}`);
                  } else {
                    console.log(`⚠️ No container match found for lastAssetId ${lastAssetId} or deviceId ${deviceId} (no anomalies)`);
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
    try { this.updateContainersFromDevices(); } catch {}
    
    // Store processed devices
    this.devices = Array.from(devices.values());
    console.log(`✅ Processed ${this.devices.length} unique devices from events`);
    
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

        // Try to find container by lastAssetId first (AssetID = container ID)
        let container = null;
        if (lastAssetId) {
          container = await storage.getContainerByCode(lastAssetId);
          if (container && !container.orbcommDeviceId) {
            // Persist the association for future lookups
            try {
              await storage.updateContainer(container.id, {
                orbcommDeviceId: device.deviceId,
                updatedAt: new Date()
              });
            } catch {}
          }
        }

        // Fallback: try orbcommDeviceId if no AssetID match
        if (!container) {
          container = await storage.getContainerByOrbcommId(device.deviceId);
        }

        if (container && device.location) {
          // Update container with telemetry data using enhanced method
          await storage.updateContainerTelemetry(container.id, {
            lastAssetId: lastAssetId || device.deviceId,
            timestamp: device.lastSeen || new Date().toISOString(),
            latitude: device.location.latitude,
            longitude: device.location.longitude,
            rawData: (device as any).rawEvent || device // Store raw Orbcomm data
          });

          console.log(`📍 Updated telemetry for container ${container.containerCode} from device ${device.deviceId} (AssetID: ${lastAssetId})`);

          // Broadcast after successful DB write to keep UI in sync
          try {
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
          } catch {}
        } else if (!container) {
          console.log(`⚠️ No container found for Orbcomm device ${device.deviceId}. Tried: AssetID match (${lastAssetId}), orbcommDeviceId match`);
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
      console.log(`🔄 Attempting to reconnect to Orbcomm (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('❌ Reconnection failed:', error);
        });
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached for Orbcomm API');
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  async sendCommand(command: any): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Orbcomm API');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
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

  // Get all devices (read-only) - returns cached devices from Orbcomm
  async getAllDevices(): Promise<OrbcommDevice[]> {
    if (!this.isConnected) {
      console.log('⚠️ Orbcomm not connected, returning cached devices');
      return this.devices;
    }
    
    // Request fresh device list if we don't have any cached
    if (this.devices.length === 0) {
      this.sendPeriodicRequest();
      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return this.devices;
  }

  // Get device data (read-only) - returns cached data from Orbcomm
  async getDeviceData(deviceId: string): Promise<OrbcommDeviceData | null> {
    if (!this.isConnected) {
      console.log('⚠️ Orbcomm not connected, returning cached data');
      return this.deviceData[deviceId] || null;
    }
    
    // Request fresh data for this device
    if (!this.deviceData[deviceId]) {
      this.requestDeviceData(deviceId);
      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.deviceData[deviceId] || null;
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
    const url = process.env.ORBCOMM_URL || 'wss://wamc.wamcentral.net:44355/cdh';
    const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
    const password = process.env.ORBCOMM_PASSWORD || 'P4pD#QU@!D@re';

    orbcommClient = new OrbcommAPIClient(url, username, password);
  }
  return orbcommClient;
}

// Initialize connection
export async function initializeOrbcommConnection(): Promise<void> {
  try {
    const client = getOrbcommClient();
    await client.connect();
    console.log('🚀 Orbcomm API initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Orbcomm API:', error);
    // Don't throw error, continue with mock data
  }
}

// Fetch data for a specific device
export async function fetchOrbcommDeviceData(deviceId: string): Promise<OrbcommDeviceData> {
  try {
    const client = getOrbcommClient();

    if (!(client as any).isConnected) {
      console.log('⚠️ Orbcomm not connected, using mock data');
      return await fetchMockDeviceData(deviceId);
    }

    const data = await client.getDeviceData(deviceId);

    if (data) {
      return data;
    } else {
      console.log('⚠️ No data from Orbcomm, using mock data');
      return await fetchMockDeviceData(deviceId);
    }
  } catch (error) {
    console.error(`❌ Error fetching Orbcomm data for ${deviceId}:`, error);
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

// Populate database with actual Orbcomm devices
export async function populateOrbcommDevices(): Promise<void> {
  try {
    const client = getOrbcommClient();

    console.log('📱 Fetching actual devices from Orbcomm CDH...');
    const devices = await client.getAllDevices();
    console.log(`📱 Found ${devices.length} actual devices from Orbcomm`);

    if (devices.length === 0) {
      console.log('⚠️ No devices received from Orbcomm, using fallback data');
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
          } catch {}
        }

        // Check if container already exists
        const existingContainer = await storage.getContainerByCode(containerCode);

        if (!existingContainer) {
          // Create new container with actual Orbcomm data
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

          console.log(`✅ Created container ${containerCode} for actual Orbcomm device ${orbcommDeviceId} (AssetID: ${containerCode})`);
        } else {
          // Update existing container with actual Orbcomm data
          await storage.updateContainer(existingContainer.id, {
            orbcommDeviceId: orbcommDeviceId,
            currentLocation: device.location ? {
              lat: device.location.latitude,
              lng: device.location.longitude
            } : existingContainer.currentLocation,
            updatedAt: new Date()
          });

          console.log(`✅ Updated container ${containerCode} with Orbcomm device ${orbcommDeviceId}`);
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
        console.error(`❌ Error processing actual Orbcomm device ${device.deviceId}:`, error);
      }
    }

    console.log('🎉 Actual Orbcomm device population completed');
  } catch (error) {
    console.error('❌ Error populating actual Orbcomm devices:', error);
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
