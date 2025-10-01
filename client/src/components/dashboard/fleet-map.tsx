import { useEffect, useRef } from "react";

declare global {
  interface Window {
    L: any;
  }
}

interface Container {
  id: string;
  containerId: string;
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  status: string;
}

interface FleetMapProps {
  containers: Container[];
}

export default function FleetMap({ containers }: FleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map(mapRef.current).setView([34.0522, -118.2437], 10);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof window.L.CircleMarker) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    // Add container markers
    containers.forEach((container) => {
      if (container.currentLocation) {
        const color =
          container.status === "active"
            ? "#22c55e"
            : container.status === "maintenance"
              ? "#f97316"
              : "#ef4444";

        const marker = window.L.circleMarker(
          [container.currentLocation.lat, container.currentLocation.lng],
          {
            radius: 8,
            fillColor: color,
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          }
        ).addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div class="p-2">
            <p class="font-mono font-semibold text-sm">${container.containerId}</p>
            <p class="text-xs text-gray-600">${container.currentLocation.address || "Unknown"}</p>
            <p class="text-xs mt-1 font-medium" style="color: ${color}">
              ${container.status.charAt(0).toUpperCase() + container.status.slice(1)}
            </p>
          </div>
        `);
      }
    });
  }, [containers]);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Real-time Fleet Map</h3>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-smooth">
            Refresh Map
          </button>
          <select className="px-3 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option>All Containers</option>
            <option>IoT Enabled</option>
            <option>Manual Tracking</option>
            <option>Active Alerts</option>
          </select>
        </div>
      </div>

      <div ref={mapRef} className="map-container bg-muted/10 rounded-lg"></div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-success rounded-full"></div>
          <span className="text-muted-foreground">Active (218)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-warning rounded-full"></div>
          <span className="text-muted-foreground">Maintenance (20)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-destructive rounded-full"></div>
          <span className="text-muted-foreground">Critical Alert (12)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-muted rounded-full"></div>
          <span className="text-muted-foreground">Offline (0)</span>
        </div>
      </div>
    </div>
  );
}
