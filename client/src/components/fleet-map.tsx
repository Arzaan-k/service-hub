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
    if (typeof window === "undefined" || !window.L) return;

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

        const marker = window.L.circleMarker([container.currentLocation.lat, container.currentLocation.lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(mapInstanceRef.current);

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

  return <div ref={mapRef} className="map-container bg-muted/10 rounded-lg"></div>;
}
