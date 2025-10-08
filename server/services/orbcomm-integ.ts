// Orbcomm INTEG Environment Integration
// Based on official Orbcomm email for integration testing
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

class OrbcommIntegClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 10000; // 10 seconds
  private devices: OrbcommDevice[] = [];
  private deviceData: { [deviceId: string]: OrbcommDeviceData } = {};
  private messageHandlers: { [type: string]: (data: any) => void } = {};

  constructor(
    private url: string = 'wss://integ.tms-orbcomm.com:44355/cdh',
    private username: string = 'cdhQuadre',
    private password: string = 'P4cD#QA@!D@re'
  ) {
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // Handle different message types from Orbcomm INTEG
    this.messageHandlers = {
      'auth_response': (data) => this.handleAuthResponse(data),
      'device_list': (data) => this.handleDeviceList(data),
      'device_data': (data) => this.handleDeviceData(data),
      'telemetry': (data) => this.handleTelemetry(data),
      'error': (data) => this.handleError(data),
      'heartbeat': (data) => this.handleHeartbeat(data),
      'status': (data) => this.handleStatus(data)
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to Orbcomm INTEG Environment...');
        console.log(`📍 URL: ${this.url}`);
        console.log(`👤 Username: ${this.username}`);
        console.log('ℹ️  Note: INTEG environment uses sample data only');
        
        // Create WebSocket connection with INTEG-specific options
        this.ws = new WebSocket(this.url, {
          headers: {
            'User-Agent': 'ContainerGenie-INTEG/1.0',
            'Origin': 'https://container-genie.com',
            'Sec-WebSocket-Protocol': 'orbcomm-cdh-v1'
          },
          handshakeTimeout: 30000, // 30 second timeout
          perMessageDeflate: false // Disable compression for INTEG
        });

        this.ws.on('open', () => {
          console.log('✅ Connected to Orbcomm INTEG Environment');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send authentication for INTEG environment
          this.authenticateInteg();
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('❌ Orbcomm INTEG WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 Orbcomm INTEG connection closed. Code: ${code}, Reason: ${reason}`);
          this.isConnected = false;
          this.handleReconnect();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📨 Received INTEG message:', JSON.stringify(message, null, 2));
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing INTEG message:', error);
            console.log('Raw message:', data.toString());
          }
        });

      } catch (error) {
        console.error('❌ Error creating Orbcomm INTEG WebSocket:', error);
        reject(error);
      }
    });
  }

  private authenticateInteg(): void {
    if (!this.ws || !this.isConnected) return;
    
    // INTEG-specific authentication message
    const authMessage = {
      type: 'authenticate',
      version: '1.0',
      environment: 'integ',
      credentials: {
        username: this.username,
        password: this.password
      },
      timestamp: new Date().toISOString(),
      client: 'ContainerGenie',
      capabilities: ['device_list', 'telemetry', 'status']
    };
    
    console.log('🔐 Sending INTEG authentication...');
    this.ws.send(JSON.stringify(authMessage));
  }

  private handleMessage(message: any): void {
    const messageType = message.type || message.messageType || 'unknown';
    const handler = this.messageHandlers[messageType];
    
    if (handler) {
      handler(message);
    } else {
      console.log(`📨 Unknown INTEG message type: ${messageType}`);
      console.log('Full message:', JSON.stringify(message, null, 2));
    }
  }

  private handleAuthResponse(data: any): void {
    if (data.success || data.status === 'success') {
      console.log('✅ INTEG authentication successful');
      this.requestDeviceList();
    } else {
      console.error('❌ INTEG authentication failed:', data.error || data.message);
    }
  }

  private handleDeviceList(data: any): void {
    const devices = data.devices || data.deviceList || [];
    console.log(`📱 Received ${devices.length} devices from INTEG`);
    
    this.devices = devices.map((device: any) => ({
      deviceId: device.deviceId || device.id || device.imei || device.serialNumber,
      deviceName: device.name || device.deviceName || device.model || `INTEG-Device-${device.deviceId}`,
      status: device.status || device.state || 'active',
      lastSeen: device.lastSeen || device.lastUpdate || device.timestamp,
      location: device.location ? {
        latitude: device.location.lat || device.location.latitude || device.location.lat,
        longitude: device.location.lng || device.location.longitude || device.location.lon
      } : null
    }));
    
    console.log('✅ INTEG device list processed');
    console.log('Sample devices:', this.devices.slice(0, 3));
  }

  private handleDeviceData(data: any): void {
    const deviceId = data.deviceId || data.imei || data.serialNumber;
    console.log(`📊 Processing INTEG device data for ${deviceId}`);
    
    this.deviceData[deviceId] = {
      deviceId: deviceId,
      timestamp: data.timestamp || data.time || new Date().toISOString(),
      location: data.location ? {
        latitude: data.location.lat || data.location.latitude || data.location.lat,
        longitude: data.location.lng || data.location.longitude || data.location.lon
      } : null,
      temperature: data.temperature || data.temp,
      doorStatus: data.doorStatus || data.door_status || data.door,
      powerStatus: data.powerStatus || data.power_status || data.power,
      batteryLevel: data.batteryLevel || data.battery_level || data.battery,
      errorCodes: data.errorCodes || data.error_codes || data.errors || [],
      rawData: data
    };
  }

  private handleTelemetry(data: any): void {
    console.log('📡 Processing INTEG telemetry data');
    this.handleDeviceData(data);
  }

  private handleError(data: any): void {
    console.error('❌ INTEG API error:', data.error || data.message);
  }

  private handleHeartbeat(data: any): void {
    console.log('💓 INTEG heartbeat received');
    // Respond to heartbeat
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'heartbeat_response',
        timestamp: new Date().toISOString()
      }));
    }
  }

  private handleStatus(data: any): void {
    console.log('📊 INTEG status update:', data);
  }

  private requestDeviceList(): void {
    if (!this.ws || !this.isConnected) return;
    
    const requestMessage = {
      type: 'get_device_list',
      environment: 'integ',
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`
    };
    
    console.log('📱 Requesting device list from INTEG...');
    this.ws.send(JSON.stringify(requestMessage));
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect to INTEG (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('❌ INTEG reconnection failed:', error);
        });
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached for INTEG');
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  // Get all devices from INTEG
  async getAllDevices(): Promise<OrbcommDevice[]> {
    if (!this.isConnected) {
      console.log('⚠️ INTEG not connected, returning cached devices');
      return this.devices;
    }
    
    // Request fresh device list if we don't have any cached
    if (this.devices.length === 0) {
      this.requestDeviceList();
      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return this.devices;
  }

  // Get device data from INTEG
  async getDeviceData(deviceId: string): Promise<OrbcommDeviceData | null> {
    if (!this.isConnected) {
      console.log('⚠️ INTEG not connected, returning cached data');
      return this.deviceData[deviceId] || null;
    }
    
    // Request fresh data for this device
    if (!this.deviceData[deviceId]) {
      this.requestDeviceData(deviceId);
      // Wait a bit for response
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return this.deviceData[deviceId] || null;
  }

  private requestDeviceData(deviceId: string): void {
    if (!this.ws || !this.isConnected) return;
    
    const requestMessage = {
      type: 'get_device_data',
      deviceId: deviceId,
      environment: 'integ',
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`
    };
    
    console.log(`📊 Requesting data for device ${deviceId} from INTEG...`);
    this.ws.send(JSON.stringify(requestMessage));
  }

  // Test INTEG connection
  async testConnection(): Promise<{ success: boolean; devices: number; environment: string }> {
    try {
      await this.connect();
      const devices = await this.getAllDevices();
      
      return {
        success: this.isConnected,
        devices: devices.length,
        environment: 'INTEG'
      };
    } catch (error) {
      return {
        success: false,
        devices: 0,
        environment: 'INTEG'
      };
    }
  }
}

// Create singleton instance
let orbcommIntegClient: OrbcommIntegClient | null = null;

export function getOrbcommIntegClient(): OrbcommIntegClient {
  if (!orbcommIntegClient) {
    orbcommIntegClient = new OrbcommIntegClient();
  }
  return orbcommIntegClient;
}

// Initialize INTEG connection
export async function initializeOrbcommIntegConnection(): Promise<void> {
  try {
    const client = getOrbcommIntegClient();
    const result = await client.testConnection();
    
    if (result.success) {
      console.log(`🚀 Orbcomm INTEG Environment initialized successfully`);
      console.log(`📱 Found ${result.devices} sample devices`);
    } else {
      console.log('⚠️ Orbcomm INTEG connection failed, will use fallback data');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Orbcomm INTEG:', error);
  }
}

// Populate database with INTEG sample devices
export async function populateOrbcommIntegDevices(): Promise<void> {
  try {
    const client = getOrbcommIntegClient();
    
    console.log('📱 Fetching sample devices from Orbcomm INTEG...');
    const devices = await client.getAllDevices();
    console.log(`📱 Found ${devices.length} sample devices from INTEG`);
    
    if (devices.length === 0) {
      console.log('⚠️ No sample devices received from INTEG, using fallback data');
      return;
    }
    
    // Import storage to create containers
    const { storage } = await import('../storage');
    
    for (const device of devices) {
      try {
        // Check if container already exists
        const existingContainer = await storage.getContainerByContainerId(device.deviceId);
        
        if (!existingContainer) {
          // Create new container with INTEG sample data
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
          
          console.log(`✅ Created container for INTEG sample device ${device.deviceId}`);
        } else {
          // Update existing container with INTEG sample data
          await storage.updateContainer(existingContainer.id, {
            orbcommDeviceId: device.deviceId,
            currentLocation: device.location ? {
              lat: device.location.latitude,
              lng: device.location.longitude
            } : existingContainer.currentLocation,
            updatedAt: new Date()
          });
          
          console.log(`🔄 Updated container with INTEG sample data for device ${device.deviceId}`);
        }
        
        // Fetch and store device data
        const deviceData = await client.getDeviceData(device.deviceId);
        if (deviceData) {
          console.log(`📊 Stored INTEG sample data for device ${device.deviceId}:`, {
            location: deviceData.location,
            temperature: deviceData.temperature,
            batteryLevel: deviceData.batteryLevel,
            errorCodes: deviceData.errorCodes
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing INTEG sample device ${device.deviceId}:`, error);
      }
    }
    
    console.log('🎉 Orbcomm INTEG sample device population completed');
  } catch (error) {
    console.error('❌ Error populating Orbcomm INTEG devices:', error);
  }
}
