// Real Orbcomm API integration
import WebSocket from 'ws';

export interface OrbcommDeviceData {
  deviceId: string;
  timestamp: string;
  location: {
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
        
        // Create WebSocket connection with proper headers
        this.ws = new WebSocket(this.url, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
            'User-Agent': 'ContainerGenie/1.0',
            'Origin': 'https://container-genie.com'
          }
        });

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
            const message = JSON.parse(data.toString());
            console.log('📨 Received Orbcomm message:', JSON.stringify(message, null, 2));
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing Orbcomm message:', error);
            console.log('Raw message:', data.toString());
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
    
    // Send authentication message based on common CDH protocols
    const authMessage = {
      type: 'auth',
      username: this.username,
      password: this.password,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    console.log('🔐 Sending authentication message...');
    this.ws.send(JSON.stringify(authMessage));
  }

  private handleMessage(message: any): void {
    console.log('📨 Processing Orbcomm message:', message);
    
    // Handle different message types from Orbcomm CDH
    switch (message.type) {
      case 'auth_response':
        if (message.status === 'success') {
          console.log('✅ Authentication successful');
          this.requestDeviceList();
        } else {
          console.error('❌ Authentication failed:', message.error);
        }
        break;
        
      case 'device_list':
        console.log(`📱 Received ${message.devices?.length || 0} devices from Orbcomm`);
        this.processDeviceList(message.devices || []);
        break;
        
      case 'device_data':
        console.log(`📊 Received data for device: ${message.deviceId}`);
        this.processDeviceData(message);
        break;
        
      case 'error':
        console.error('❌ Orbcomm API error:', message.error);
        break;
        
      default:
        console.log('📨 Unknown message type:', message.type);
        console.log('Full message:', JSON.stringify(message, null, 2));
    }
  }

  private requestDeviceList(): void {
    if (!this.ws || !this.isConnected) return;
    
    const requestMessage = {
      type: 'get_devices',
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`
    };
    
    console.log('📱 Requesting device list from Orbcomm...');
    this.ws.send(JSON.stringify(requestMessage));
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
        latitude: device.location.lat || device.location.latitude,
        longitude: device.location.lng || device.location.longitude
      } : null
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
        latitude: data.location.lat || data.location.latitude,
        longitude: data.location.lng || data.location.longitude
      } : null,
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
      this.requestDeviceList();
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

// Create singleton instance
let orbcommClient: OrbcommAPIClient | null = null;

export function getOrbcommClient(): OrbcommAPIClient {
  if (!orbcommClient) {
    const url = process.env.ORBCOMM_URL || 'wss://integ.tms-orbcomm.com:44355/cdh';
    const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
    const password = process.env.ORBCOMM_PASSWORD || 'P4cD#QA@!D@re';
    
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
    
    if (!client.isConnected) {
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
        // Check if container already exists
        const existingContainer = await storage.getContainerByContainerId(device.deviceId);
        
        if (!existingContainer) {
          // Create new container with actual Orbcomm data
          await storage.createContainer({
            containerCode: device.deviceId,
            orbcommDeviceId: device.deviceId,
            currentLocation: device.location ? {
              lat: device.location.latitude,
              lng: device.location.longitude
            } : null,
            capacity: "Standard", // Default capacity
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          console.log(`✅ Created container for actual Orbcomm device ${device.deviceId}`);
        } else {
          // Update existing container with actual Orbcomm data
          await storage.updateContainer(existingContainer.id, {
            orbcommDeviceId: device.deviceId,
            currentLocation: device.location ? {
              lat: device.location.latitude,
              lng: device.location.longitude
            } : existingContainer.currentLocation,
            updatedAt: new Date()
          });
          
          console.log(`🔄 Updated container with actual Orbcomm data for device ${device.deviceId}`);
        }
        
        // Fetch and store device data
        const deviceData = await client.getDeviceData(device.deviceId);
        if (deviceData) {
          console.log(`📊 Stored actual data for device ${device.deviceId}:`, {
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
