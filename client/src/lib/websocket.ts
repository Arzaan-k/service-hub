export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private authToken: string | null = null;

  constructor(private url?: string) {
    try {
      this.authToken = localStorage.getItem('auth_token');
    } catch {}
    this.connect();
  }

private connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Allow explicit URL via env or constructor
    let wsUrl = this.url;
    const envUrl = (import.meta as any)?.env?.VITE_WS_URL as string | undefined;
    if (!wsUrl && envUrl) wsUrl = envUrl;

    if (!wsUrl) {
      // Derive from location with safe fallback for dev
      let host = window.location.host;
      if (!host || host.indexOf(":") < 0) {
        // No port specified (some embedded setups) → fallback
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          host = "localhost:5000";
        } else {
          host = window.location.hostname + ":5000";
        }
      }
      wsUrl = `${protocol}//${host}/ws`;
    }

    console.log("Attempting WebSocket connection to:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected to:", wsUrl);
        this.reconnectAttempts = 0;
        // Authenticate socket so server delivers role/user-scoped events
        try {
          const token = this.authToken || localStorage.getItem('auth_token');
          if (token && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'authenticate', token }));
          }
        } catch (error) {
          console.error("WebSocket auth error:", error);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data);
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected from:", wsUrl);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const websocket = new WebSocketClient();
