/**
 * WebSocket Client for Real-time Updates
 * Handles connection to the server WebSocket and event management
 */

type WebSocketEventHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000; // 3 seconds
  private isIntentionallyClosed = false;

  /**
   * Connect to the WebSocket server
   */
  public connect(userId?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isIntentionallyClosed = false;

    // Determine WebSocket URL - always connect to backend server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Use environment variable if available, otherwise construct backend URL
    let wsUrl;
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (import.meta.env.VITE_WEBSOCKET_URL) {
      wsUrl = import.meta.env.VITE_WEBSOCKET_URL;
    } else {
      // Always connect to backend on port 5000
      const hostname = window.location.hostname || 'localhost';
      wsUrl = `${protocol}//${hostname}:5000/ws`;
    }

    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;

        // Authenticate if userId is provided
        if (userId) {
          this.authenticate(userId);
        }

        // Notify connection handlers
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type);

          // Emit the event to registered handlers
          this.emit(message.type, message.data || message);

        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('disconnected', {});

        // Attempt to reconnect if not intentionally closed
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect(userId);
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.scheduleReconnect(userId);
    }
  }

  /**
   * Authenticate the WebSocket connection
   */
  private authenticate(userId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'authenticate',
        token: userId
      });
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(userId?: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect(userId);
    }, delay);
  }

  /**
   * Send a message through the WebSocket
   */
  public send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Register an event handler
   */
  public on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  public off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect from the WebSocket
   */
  public disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export a singleton instance
export const websocket = new WebSocketClient();

// Auto-connect on module load
if (typeof window !== 'undefined') {
  // Connect after a short delay to allow the page to load
  setTimeout(() => {
    websocket.connect();
  }, 1000);
}
