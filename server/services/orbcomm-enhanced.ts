// Enhanced Orbcomm CDH API integration with multiple authentication methods
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

class EnhancedOrbcommClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 10000; // 10 seconds
  private devices: OrbcommDevice[] = [];
  private deviceData: { [deviceId: string]: OrbcommDeviceData } = {};
  private authMethods = ['basic', 'token', 'session'];
  private currentAuthMethod = 0;

  constructor(
    private url: string,
    private username: string,
    private password: string
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to Orbcomm CDH API (Enhanced)...');
        console.log(`📍 URL: ${this.url}`);
        console.log(`👤 Username: ${this.username}`);
        console.log(`🔐 Auth Method: ${this.authMethods[this.currentAuthMethod]}`);
        
        // Try different connection methods
        const connectionOptions = this.getConnectionOptions();
        
        // Always include required subprotocol 'cdh.orbcomm.com'
        this.ws = new WebSocket(this.url, 'cdh.orbcomm.com', connectionOptions);

        this.ws.on('open', () => {
          console.log('✅ Connected to Orbcomm CDH API');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Try authentication
          this.attemptAuthentication();
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('❌ Orbcomm WebSocket error:', error);
          this.isConnected = false;
          
          // Try next authentication method
          if (this.currentAuthMethod < this.authMethods.length - 1) {
            this.currentAuthMethod++;
            console.log(`🔄 Trying next authentication method: ${this.authMethods[this.currentAuthMethod]}`);
            setTimeout(() => {
              this.connect().catch(console.error);
            }, 2000);
          } else {
            reject(error);
          }
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

  private getConnectionOptions(): any {
    const authMethod = this.authMethods[this.currentAuthMethod];
    
    switch (authMethod) {
      case 'basic':
        return {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
            'User-Agent': 'ContainerGenie/1.0',
            'Origin': 'https://container-genie.com'
          }
        };
        
      case 'token':
        return {
          headers: {
            'Authorization': `Bearer ${this.password}`,
            'User-Agent': 'ContainerGenie/1.0',
            'Origin': 'https://container-genie.com'
          }
        };
        
      case 'session':
        return {
          headers: {
            'X-Username': this.username,
            'X-Password': this.password,
            'User-Agent': 'ContainerGenie/1.0',
            'Origin': 'https://container-genie.com'
          }
        };
        
      default:
        return {};
    }
  }

  private attemptAuthentication(): void {
    if (!this.ws || !this.isConnected) return;
    
    const authMethod = this.authMethods[this.currentAuthMethod];
    let authMessage: any;
    
    switch (authMethod) {
      case 'basic':
        authMessage = {
          type: 'auth',
          method: 'basic',
          username: this.username,
          password: this.password,
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'token':
        authMessage = {
          type: 'auth',
          method: 'token',
          token: this.password,
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'session':
        authMessage = {
          type: 'login',
          username: this.username,
          password: this.password,
          timestamp: new Date().toISOString()
        };
        break;
    }
    
    console.log(`🔐 Sending ${authMethod} authentication...`);
    this.ws.send(JSON.stringify(authMessage));
  }

  private handleMessage(message: any): void {
    console.log('📨 Processing Orbcomm message:', message);
    
    // Handle different message types from Orbcomm CDH
    switch (message.type) {
      case 'auth_response':
      case 'login_response':
        if (message.status === 'success' || message.success === true) {
          console.log('✅ Authentication successful');
          this.requestDeviceList();
        } else {
          console.error('❌ Authentication failed:', message.error || message.message);
        }
        break;
        
      case 'device_list':
      case 'devices':
        console.log(`📱 Received ${message.devices?.length || 0} devices from Orbcomm`);
        this.processDeviceList(message.devices || []);
        break;
        
      case 'device_data':
      case 'telemetry':
        console.log(`📊 Received data for device: ${message.deviceId || message.imei}`);
        this.processDeviceData(message);
        break;
        
      case 'error':
        console.error('❌ Orbcomm API error:', message.error || message.message);
        break;
        
      default:
        console.log('📨 Unknown message type:', message.type);
        console.log('Full message:', JSON.stringify(message, null, 2));
        
        // Try to extract device data from unknown message format
        if (message.deviceId || message.imei) {
          this.processDeviceData(message);
        }
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
      deviceId: device.deviceId || device.id || device.imei || device.serialNumber,
      deviceName: device.name || device.deviceName || device.model || `Device ${device.deviceId}`,
      status: device.status || device.state || 'active',
      lastSeen: device.lastSeen || device.lastUpdate || device.timestamp,
      location: device.location ? {
        latitude: device.location.lat || device.location.latitude || device.location.lat,
        longitude: device.location.lng || device.location.longitude || device.location.lon
      } : null
    }));
    
    console.log('✅ Device list processed and stored');
    console.log('Sample devices:', this.devices.slice(0, 3));
  }

  private processDeviceData(data: any): void {
    const deviceId = data.deviceId || data.imei || data.serialNumber;
    console.log(`📊 Processing device data for ${deviceId}`);
    
    // Store device data for later retrieval
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
      await new Promise(resolve => setTimeout(resolve, 3000));
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
      await new Promise(resolve => setTimeout(resolve, 2000));
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

  // Test connection with different protocols
  async testConnection(): Promise<{ success: boolean; method: string; devices: number }> {
    try {
      await this.connect();
      const devices = await this.getAllDevices();
      
      return {
        success: this.isConnected,
        method: this.authMethods[this.currentAuthMethod],
        devices: devices.length
      };
    } catch (error) {
      return {
        success: false,
        method: this.authMethods[this.currentAuthMethod],
        devices: 0
      };
    }
  }
}

// Create singleton instance
let enhancedOrbcommClient: EnhancedOrbcommClient | null = null;

export function getEnhancedOrbcommClient(): EnhancedOrbcommClient {
  if (!enhancedOrbcommClient) {
    const url = process.env.ORBCOMM_URL || 'wss://integ.tms-orbcomm.com:44355/cdh';
    const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
    const password = process.env.ORBCOMM_PASSWORD || 'P4cD#QA@!D@re';
    
    enhancedOrbcommClient = new EnhancedOrbcommClient(url, username, password);
  }
  return enhancedOrbcommClient;
}

// Initialize enhanced connection
export async function initializeEnhancedOrbcommConnection(): Promise<void> {
  try {
    const client = getEnhancedOrbcommClient();
    const result = await client.testConnection();
    
    if (result.success) {
      console.log(`🚀 Enhanced Orbcomm API initialized successfully with ${result.method} authentication`);
      console.log(`📱 Found ${result.devices} devices`);
    } else {
      console.log('⚠️ Enhanced Orbcomm connection failed, will use fallback data');
    }
  } catch (error) {
    console.error('❌ Failed to initialize enhanced Orbcomm API:', error);
  }
}

// Populate database with actual Orbcomm devices using enhanced client
export async function populateEnhancedOrbcommDevices(): Promise<void> {
  try {
    const client = getEnhancedOrbcommClient();
    
    console.log('📱 Fetching actual devices from enhanced Orbcomm CDH...');
    const devices = await client.getAllDevices();
    console.log(`📱 Found ${devices.length} actual devices from enhanced Orbcomm`);
    
    if (devices.length === 0) {
      console.log('⚠️ No devices received from enhanced Orbcomm, using fallback data');
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
          
          console.log(`✅ Created container for actual enhanced Orbcomm device ${device.deviceId}`);
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
          
          console.log(`🔄 Updated container with actual enhanced Orbcomm data for device ${device.deviceId}`);
        }
        
        // Fetch and store device data
        const deviceData = await client.getDeviceData(device.deviceId);
        if (deviceData) {
          console.log(`📊 Stored actual enhanced data for device ${device.deviceId}:`, {
            location: deviceData.location,
            temperature: deviceData.temperature,
            batteryLevel: deviceData.batteryLevel,
            errorCodes: deviceData.errorCodes
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing actual enhanced Orbcomm device ${device.deviceId}:`, error);
      }
    }
    
    console.log('🎉 Actual enhanced Orbcomm device population completed');
  } catch (error) {
    console.error('❌ Error populating actual enhanced Orbcomm devices:', error);
  }
}
