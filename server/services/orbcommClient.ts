import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Orbcomm CDH WebSocket Client
 * Connects to Orbcomm's production CDH alert feed and processes real-time alerts
 * Smart: Tracks last event ID to prevent duplicates and resume from where it left off
 * Implements robust polling to ensure all data is retrieved
 */

// Production credentials from email/request
const PRODUCTION_CONFIG = {
  url: 'wss://wamc.wamcentral.net:44355/cdh',
  username: 'cdhQuadre',
  password: 'P4pD#QU@!D@re',
  protocol: 'cdh.orbcomm.com'
};

// Configuration with fallback to environment variables
let ORBCOMM_CONFIG: {
  url: string;
  protocol: string;
  username: string;
  password: string;
} | null = null;

function getOrbcommConfig() {
  if (!ORBCOMM_CONFIG) {
    ORBCOMM_CONFIG = {
      url: process.env.ORBCOMM_URL || PRODUCTION_CONFIG.url,
      protocol: 'cdh.orbcomm.com',
      username: process.env.ORBCOMM_USERNAME || PRODUCTION_CONFIG.username,
      password: process.env.ORBCOMM_PASSWORD || PRODUCTION_CONFIG.password,
    };
    console.log(`📋 Orbcomm CDH Config initialized: ${ORBCOMM_CONFIG.url}`);
  }
  return ORBCOMM_CONFIG;
}

// Request queue to prevent parallel requests (Fault Code 2006)
interface QueuedRequest {
  message: any;
  timestamp: number;
}

class OrbcommClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // Start with 5 seconds
  private maxReconnectDelay = 60000; // Max 60 seconds
  private isConnecting = false;
  private isSubscribed = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  // Request queue management
  private requestQueue: QueuedRequest[] = [];
  private isProcessingRequest = false;
  private requestTimeout: NodeJS.Timeout | null = null;

  // Alert callback
  private onAlertCallback: ((alert: any) => void) | null = null;

  // Event tracking for smart data fetching (no duplicates)
  private lastEventId: string | null = null;
  private processedEventIds = new Set<string>();
  private maxProcessedIds = 1000; // Keep track of last 1k event IDs (reduced for memory efficiency)
  private eventSequence = 0;

  // Polling state
  private currentBatchCount = 0;
  private readonly MAX_EVENT_COUNT = 50; // Reduced batch size for memory
  private readonly POLL_INTERVAL_MS = 300000; // Poll every 5 minutes (reduced for Render free tier)
  private responseInProgress = false; // Mutex to prevent Fault 2006

  // Statistics
  private stats = {
    connected: false,
    lastConnectedAt: null as Date | null,
    totalAlertsReceived: 0,
    lastAlertAt: null as Date | null,
    errors: 0,
    duplicatesSkipped: 0,
    lastPollAt: null as Date | null,
  };

  // Device state tracking
  private devices = new Map<string, any>();

  constructor() {
    console.log('🚀 Orbcomm CDH Client initialized');

    // Load last event ID from disk to resume where we left off
    this.loadLastEventId();
  }

  /**
   * Get all tracked devices
   */
  public getAllDevices(): any[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get data for a specific device
   */
  public getDeviceData(deviceId: string): any | null {
    return this.devices.get(deviceId) || null;
  }


  /**
   * Get connection status
   */
  public get isConnected(): boolean {
    return this.stats.connected;
  }

  /**
   * Load last event ID from persistent storage
   */
  private loadLastEventId(): void {
    try {
      const stateDir = path.join(process.cwd(), 'logs', 'orbcomm');
      const stateFile = path.join(stateDir, 'last-event-state.json');

      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        this.lastEventId = state.lastEventId;
        console.log(`📋 Loaded last event ID from disk: ${this.lastEventId}`);
        console.log(`📅 Last saved: ${state.lastSaved}`);
      } else {
        console.log('📋 No previous state found, starting fresh');
      }
    } catch (error) {
      console.error('❌ Failed to load last event ID:', error);
    }
  }

  /**
   * Save last event ID to persistent storage
   */
  private saveLastEventId(): void {
    try {
      if (!this.lastEventId) return;

      const stateDir = path.join(process.cwd(), 'logs', 'orbcomm');
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      const stateFile = path.join(stateDir, 'last-event-state.json');
      const state = {
        lastEventId: this.lastEventId,
        eventSequence: this.eventSequence,
        lastSaved: new Date().toISOString(),
        totalAlertsReceived: this.stats.totalAlertsReceived,
      };

      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('❌ Failed to save last event ID:', error);
    }
  }

  /**
   * Start the Orbcomm WebSocket client
   */
  public async start(onAlert?: (alert: any) => void): Promise<void> {
    if (onAlert) {
      this.onAlertCallback = onAlert;
    }

    console.log('🔌 Starting Orbcomm CDH WebSocket client...');
    await this.connect();
  }

  /**
   * Stop the Orbcomm WebSocket client
   */
  public stop(): void {
    console.log('🛑 Stopping Orbcomm CDH client...');

    // Save state before shutdown to resume later
    this.saveLastEventId();
    console.log('💾 Saved last event ID for resumption');

    this.clearTimers();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client shutdown');
      }
      this.ws = null;
    }

    this.isConnecting = false;
    this.isSubscribed = false;
    this.stats.connected = false;

    console.log('✅ Orbcomm CDH client stopped');
  }

  private clearTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.requestTimeout) {
      clearTimeout(this.requestTimeout);
      this.requestTimeout = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Connect to Orbcomm CDH WebSocket
   */
  private async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('⏭️  Already connected or connecting, skipping...');
      return;
    }

    this.isConnecting = true;

    try {
      const config = getOrbcommConfig();
      console.log(`🔗 Connecting to Orbcomm CDH: ${config.url}`);

      // Generate Basic Auth header (exactly as specified by Orbcomm support)
      const authString = `${config.username}:${config.password}`;
      const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

      console.log(`🔑 Auth header (base64): ${authHeader}`);
      console.log(`🔌 Protocol: ${config.protocol}`);

      // Create WebSocket connection with CDH protocol and auth
      // Using only the headers specified by Orbcomm in their Postman instructions
      this.ws = new WebSocket(config.url, config.protocol, {
        headers: {
          'Authorization': authHeader
        },
        handshakeTimeout: 30000 // 30 second timeout
      });

      this.setupEventHandlers();

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.stats.errors++;
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      console.log('✅ Connected to Orbcomm CDH successfully!');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;
      this.stats.connected = true;
      this.stats.lastConnectedAt = new Date();

      // Start polling for events
      this.startPolling();

      // Start heartbeat
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        // Clean the message string to remove control characters that break JSON parsing
        const rawMessage = data.toString();
        // Replace control characters (except for spaces, tabs, newlines in strings)
        const cleanedMessage = rawMessage.replace(/[\x00-\x1F\x7F]/g, (char) => {
          if (char === '\n' || char === '\r' || char === '\t') {
            return ' ';
          }
          return '';
        });

        const message = JSON.parse(cleanedMessage);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse message:', error);

        // Try to extract fault information even if JSON parsing fails
        const rawStr = data.toString();
        if (rawStr.includes('faultCode')) {
          console.log('⚠️  Server returned a fault. Check connection and credentials.');
        }
      }
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.stats.errors++;
    });

    this.ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason || 'No reason provided'}`);
      this.stats.connected = false;
      this.isSubscribed = false;

      this.clearTimers();

      // Only reconnect if not intentionally closed
      if (code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('ping', () => {
      if (this.ws) {
        this.ws.pong();
      }
    });
  }

  /**
   * Start the polling loop
   */
  private startPolling(): void {
    // Initial fetch after a delay to let connection stabilize
    setTimeout(() => this.fetchEvents(), 2000);

    // Setup periodic polling (for when we are caught up)
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(() => {
      // Only poll if we are not currently processing a request/response
      // And if the queue is empty and no response in progress
      if (this.requestQueue.length === 0 && !this.isProcessingRequest && !this.responseInProgress) {
        console.log('⏰ Polling interval triggered');
        this.fetchEvents();
      } else {
        console.log('⏭️  Skipping poll - response still in progress or queue not empty');
      }
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Send GetEvents request to receive alerts
   */
  private fetchEvents(): void {
    // Prevent concurrent requests - check both processing and response flags
    if (this.responseInProgress || this.isProcessingRequest) {
      console.log('⏭️  Skipping fetch - previous request still in progress');
      return;
    }

    // Reset batch count for the new request
    this.currentBatchCount = 0;

    const getEventsMessage: any = {
      GetEvents: {
        EventType: 'all',
        EventPartition: 1,
        MaxEventCount: this.MAX_EVENT_COUNT
      }
    };

    // Smart fetching: Use PrecedingEventID to get only NEW events after the last one
    if (this.lastEventId) {
      getEventsMessage.GetEvents.PrecedingEventID = this.lastEventId;
      console.log(`📨 Sending GetEvents request (continuing from event ${this.lastEventId})...`);
    } else {
      console.log('📨 Sending initial GetEvents request (fetching recent events)...');
    }

    this.stats.lastPollAt = new Date();
    this.responseInProgress = true; // Mark that we're waiting for a response
    this.queueRequest(getEventsMessage);
  }

  /**
   * Queue a request to prevent parallel requests (Fault Code 2006)
   */
  private queueRequest(message: any): void {
    this.requestQueue.push({
      message,
      timestamp: Date.now()
    });

    console.log(`📥 Request queued. Queue length: ${this.requestQueue.length}`);
    this.processQueue();
  }

  /**
   * Process request queue one at a time
   */
  private async processQueue(): Promise<void> {
    // If already processing or queue is empty, return
    if (this.isProcessingRequest || this.requestQueue.length === 0) {
      return;
    }

    // If WebSocket is not open, clear queue and wait
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('⏸️  WebSocket not ready, clearing queue...');
      this.requestQueue = [];
      this.responseInProgress = false;
      return;
    }

    this.isProcessingRequest = true;
    const queuedRequest = this.requestQueue.shift();

    if (!queuedRequest) {
      this.isProcessingRequest = false;
      this.responseInProgress = false;
      return;
    }

    try {
      const messageStr = JSON.stringify(queuedRequest.message);
      console.log('📤 Sending request:', messageStr);

      this.ws.send(messageStr);

      // Set a longer timeout for response (30 seconds for slow connections)
      this.requestTimeout = setTimeout(() => {
        console.log('⏱️  Request timeout - resetting state');
        this.isProcessingRequest = false;
        this.responseInProgress = false;
        // Don't immediately process queue, let next poll handle it
      }, 30000); // 30 second timeout per request

    } catch (error) {
      console.error('❌ Failed to send request:', error);
      this.isProcessingRequest = false;
      this.responseInProgress = false;
      // Don't immediately process queue, let next poll handle it
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    // Clear request timeout when we receive any message
    if (this.requestTimeout) {
      clearTimeout(this.requestTimeout);
      this.requestTimeout = null;
    }

    // Mark request as processed
    this.isProcessingRequest = false;

    // Handle faults array from Orbcomm
    if (message.faults && Array.isArray(message.faults)) {
      console.error('⚠️  Received faults from Orbcomm:');
      let hasFault2006 = false;
      message.faults.forEach((faultObj: any) => {
        const fault = faultObj.fault || faultObj;
        console.error(`   - Fault ${fault.faultCode}: ${fault.faultText}`);

        // If fault 2006 (Response in progress), keep responseInProgress true
        if (fault.faultCode === 2006) {
          hasFault2006 = true;
          console.log('   -> Response already in progress, will wait for next poll.');
        }
      });

      // Only reset responseInProgress if it's NOT a 2006 fault
      // (2006 means the server is still processing, so we wait)
      if (!hasFault2006) {
        this.responseInProgress = false;
      }
      return;
    }

    // Handle Orbcomm CDH Event messages
    if (message.Event) {
      this.isSubscribed = true;
      this.handleAlert(message);
      // Don't reset responseInProgress here - let handleAlert batch logic manage it
      return;
    }

    if (message.faultCode) {
      console.error('⚠️  Received fault code:', message.faultCode, message.faultString);
      this.responseInProgress = false;
      return;
    }

    // For any other message type, reset the response flag
    this.responseInProgress = false;

    // Log any other message types
    console.log('📨 Received message:', JSON.stringify(message, null, 2));
  }


  /**
   * Handle alert messages with smart duplicate detection
   */
  private handleAlert(alert: any): void {
    try {
      // Increment batch count
      this.currentBatchCount++;

      // Extract event ID from the message
      const eventId = alert.Event?.MessageData?.MsgID;
      const sequence = alert.Sequence;

      // Check for duplicates using MsgID
      if (eventId) {
        if (this.processedEventIds.has(eventId)) {
          this.stats.duplicatesSkipped++;
          console.log(`⏭️  Skipping duplicate event ${eventId} (sequence: ${sequence})`);
          return;
        }

        // Add to processed set
        this.processedEventIds.add(eventId);

        // Keep set size manageable - more aggressive cleanup for memory
        if (this.processedEventIds.size > this.maxProcessedIds) {
          const idsArray = Array.from(this.processedEventIds);
          this.processedEventIds = new Set(idsArray.slice(-500)); // Keep only last 500
        }

        // Update lastEventId for next GetEvents request
        this.lastEventId = eventId;

        // Save state every 25 events (reduced frequency)
        if (this.stats.totalAlertsReceived % 25 === 0) {
          this.saveLastEventId();
        }
      }

      if (sequence) {
        this.eventSequence = sequence;
      }

      this.stats.totalAlertsReceived++;
      this.stats.lastAlertAt = new Date();

      console.log(`🔔 New Alert [${this.currentBatchCount}/${this.MAX_EVENT_COUNT}] ID: ${eventId}`);

      // --- Device State Tracking Logic (Memory Optimized) ---
      try {
        const eventData = alert.Event || alert;
        const deviceId = eventData.deviceId || eventData.DeviceId || eventData.IMEI ||
          eventData.DeviceData?.DeviceID || eventData.DeviceData?.DeviceId ||
          eventData.MessageData?.DeviceID;

        if (deviceId) {
          // Extract AssetID (Container ID)
          const assetId = eventData.assetId || eventData.AssetID || eventData.LastAssetID ||
            eventData.ReeferData?.AssetID || eventData.DeviceData?.LastAssetID ||
            eventData.MessageData?.AssetID;

          // Extract Timestamp
          const timestamp = eventData.timestamp || eventData.EventUTC || eventData.Timestamp ||
            eventData.MessageData?.EventDtm || new Date().toISOString();

          // Extract Location
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

          // Extract Telemetry
          const reeferData = eventData.ReeferData || {};

          // Temperature
          let temperature: number | undefined;
          if (reeferData.TAmb !== undefined) temperature = reeferData.TAmb;
          else if (deviceData.DeviceTemp !== undefined) temperature = deviceData.DeviceTemp;
          else if (eventData.Temperature !== undefined) temperature = eventData.Temperature;

          // Door Status
          let doorStatus: string | undefined;
          if (deviceData.DoorState) doorStatus = deviceData.DoorState.toLowerCase();
          else if (eventData.DoorState) doorStatus = eventData.DoorState.toLowerCase();

          // Power Status
          let powerStatus: string | undefined;
          if (deviceData.ExtPower !== undefined) powerStatus = deviceData.ExtPower ? 'on' : 'off';
          else if (eventData.PowerStatus) powerStatus = eventData.PowerStatus.toLowerCase();

          // Battery Level
          let batteryLevel: number | undefined;
          if (deviceData.BatteryVoltage !== undefined) {
            // Convert voltage to percentage (assuming 8.1V is 100%)
            batteryLevel = Math.min(100, Math.max(0, (deviceData.BatteryVoltage / 8.1) * 100));
          }

          // Error Codes
          const errorCodes: string[] = [];
          if (reeferData.ReeferAlarms && Array.isArray(reeferData.ReeferAlarms)) {
            reeferData.ReeferAlarms.forEach((alarm: any) => {
              if (alarm.Active) {
                errorCodes.push(alarm.RCAlias || `E${alarm.OemAlarm}`);
              }
            });
          }

          // Update Device State - NO rawData stored to save memory
          const deviceInfo = {
            deviceId,
            assetId: assetId || this.devices.get(deviceId)?.assetId,
            lastAssetId: assetId || this.devices.get(deviceId)?.lastAssetId,
            status: 'active',
            lastSeen: timestamp,
            lastUpdate: timestamp,
            location: location || this.devices.get(deviceId)?.location,
            temperature: temperature !== undefined ? Math.round(temperature) : this.devices.get(deviceId)?.temperature,
            doorStatus: doorStatus || this.devices.get(deviceId)?.doorStatus,
            powerStatus: powerStatus || this.devices.get(deviceId)?.powerStatus,
            batteryLevel: batteryLevel !== undefined ? batteryLevel : this.devices.get(deviceId)?.batteryLevel,
            errorCodes: errorCodes.length > 0 ? errorCodes : (this.devices.get(deviceId)?.errorCodes || []),
            // rawData removed for memory optimization
          };

          this.devices.set(deviceId, deviceInfo);
        }
      } catch (err) {
        console.error('❌ Error updating device state:', err);
      }
      // -----------------------------------

      // Call the callback
      if (this.onAlertCallback) {
        try {
          this.onAlertCallback(alert);
        } catch (error) {
          console.error('❌ Error in alert callback:', error);
        }
      }

      // Check if we've received a full batch
      if (this.currentBatchCount >= this.MAX_EVENT_COUNT) {
        console.log('📥 Received full batch of events. Will fetch next batch on next poll...');
        // Reset count - next poll will fetch more
        this.currentBatchCount = 0;
        // Reset response flag to allow next poll to proceed immediately
        this.responseInProgress = false;
        // Don't call fetchEvents directly - let the next poll handle it to prevent memory spikes
      } else {
        // Partial batch means we're caught up - reset response flag
        // This happens when we get fewer events than MAX_EVENT_COUNT
        // But only reset after a short delay to ensure all events in batch are processed
      }

    } catch (error) {
      console.error('❌ Error processing alert:', error);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Stopping reconnection.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Get current statistics
   */
  public getStats() {
    return {
      ...this.stats,
      reconnectAttempts: this.reconnectAttempts,
      isSubscribed: this.isSubscribed,
      queueLength: this.requestQueue.length,
      lastEventId: this.lastEventId,
      eventSequence: this.eventSequence,
      processedEventCount: this.processedEventIds.size,
      duplicatesSkipped: this.stats.duplicatesSkipped,
    };
  }
}

// Singleton instance
let orbcommClient: OrbcommClient | null = null;

/**
 * Start the Orbcomm CDH client
 * @param onAlert Optional callback function to handle alerts
 */
export async function startOrbcommClient(onAlert?: (alert: any) => void): Promise<OrbcommClient> {
  if (!orbcommClient) {
    orbcommClient = new OrbcommClient();
  }

  await orbcommClient.start(onAlert);
  return orbcommClient;
}

/**
 * Stop the Orbcomm CDH client
 */
export function stopOrbcommClient(): void {
  if (orbcommClient) {
    orbcommClient.stop();
    orbcommClient = null;
  }
}

/**
 * Get the current Orbcomm client instance
 */
export function getOrbcommClient(): OrbcommClient | null {
  return orbcommClient;
}

export { OrbcommClient };
