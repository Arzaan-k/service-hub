import { useEffect, useRef } from "react";

declare global {
  interface Window {
    L: any;
  }
}

interface Container {
  id: string;
  containerCode: string;
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  healthScore?: number;
  usageCycles?: number;
  capacity?: string;
  orbcommDeviceId?: string;
  hasIot?: boolean;
  locationLat?: string;
  locationLng?: string;
  temperature?: number;
  powerStatus?: string;
  status?: string;
  type?: string;
}

interface FleetMapProps {
  containers: Container[];
}

export default function FleetMap({ containers }: FleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  // Calculate statistics for display
  const stats = {
    total: containers?.length || 0,
    withGps: 0,
    iotEnabled: 0,
    active: 0,
    maintenance: 0,
    critical: 0,
    offline: 0
  };

  // Count containers with GPS and their statuses
  containers?.forEach(container => {
    const hasGps = !!(
      (container.currentLocation?.lat && container.currentLocation?.lng) ||
      (container.locationLat && container.locationLng &&
        parseFloat(container.locationLat) !== 0 && parseFloat(container.locationLng) !== 0)
    );

    if (hasGps) {
      stats.withGps++;
    }

    const hasIot = !!container.orbcommDeviceId || container.hasIot;
    if (hasIot) stats.iotEnabled++;

    // Determine status
    const healthScore = container.healthScore || 0;
    const temperature = container.temperature;
    const powerStatus = container.powerStatus;

    if (temperature && temperature > 30) {
      stats.critical++;
    } else if (powerStatus === 'off' || powerStatus === 'offline') {
      stats.offline++;
    } else if (healthScore >= 80) {
      stats.active++;
    } else if (healthScore >= 60) {
      stats.maintenance++;
    } else if (healthScore > 0) {
      stats.critical++;
    } else {
      stats.offline++;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.L || !mapRef.current || !containers) return;

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

    // Add container markers - check for GPS coordinates in all possible formats
    containers.forEach((container) => {
      // Check for GPS coordinates in multiple possible locations
      let lat: number | null = null;
      let lng: number | null = null;

      // Priority order for GPS coordinates:
      // 1. currentLocation.lat/lng (preferred)
      if (container.currentLocation?.lat && container.currentLocation?.lng) {
        lat = container.currentLocation.lat;
        lng = container.currentLocation.lng;
      }
      // 2. locationLat/locationLng as strings
      else if (container.locationLat && container.locationLng) {
        lat = parseFloat(container.locationLat);
        lng = parseFloat(container.locationLng);
      }

      // Only create marker if we have valid coordinates
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        // Determine status and color based on multiple factors
        const healthScore = container.healthScore || 0;
        const hasIot = !!container.orbcommDeviceId || container.hasIot;
        const temperature = container.temperature;
        const powerStatus = container.powerStatus;

        let status = container.status || "unknown";
        let color = "#6b7280"; // Default gray

        // Priority for color coding:
        // 1. Critical temperature (>30°C)
        if (temperature && temperature > 30) {
          status = "critical";
          color = "#ef4444"; // Red
        }
        // 2. Power issues
        else if (powerStatus === 'off' || powerStatus === 'offline') {
          status = "power_issue";
          color = "#f97316"; // Orange
        }
        // 3. IoT connectivity
        else if (hasIot) {
          status = "active";
          color = "#10b981"; // Green
        }
        // 4. Health score
        else if (healthScore >= 80) {
          status = "active";
          color = "#73C8D2"; // Light cyan
        } else if (healthScore >= 60) {
          status = "maintenance";
          color = "#f59e0b"; // Amber
        } else if (healthScore > 0) {
          status = "critical";
          color = "#ef4444"; // Red
        }

        const marker = window.L.circleMarker(
          [lat, lng],
          {
            radius: 8,
            fillColor: color,
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          }
        ).addTo(mapInstanceRef.current);

        const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
        const locationDisplay = container.currentLocation?.address ||
          `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

        const temperatureDisplay = temperature ? `${temperature}°C` : 'N/A';
        const powerDisplay = powerStatus ? powerStatus.toUpperCase() : 'N/A';

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-mono font-bold text-sm">${container.containerCode || "Unknown"}</h3>
              <span class="text-xs px-2 py-1 rounded-full text-white font-medium" style="background-color: ${color}">
                ${statusDisplay}
              </span>
            </div>
            <div class="space-y-1 text-xs">
              <p><span class="font-medium">Location:</span> ${locationDisplay}</p>
              <p><span class="font-medium">Type:</span> ${container.type || "Unknown"}</p>
              <p><span class="font-medium">Capacity:</span> ${container.capacity || "Unknown"}</p>
              ${temperature ? `<p><span class="font-medium">Temperature:</span> ${temperatureDisplay}</p>` : ''}
              ${powerStatus ? `<p><span class="font-medium">Power:</span> ${powerDisplay}</p>` : ''}
              ${healthScore > 0 ? `<p><span class="font-medium">Health:</span> ${healthScore}%</p>` : ''}
              <p class="mt-2"><span class="font-medium">Tracking:</span> ${hasIot ? "IoT Enabled" : "Manual"}</p>
            </div>
          </div>
        `);

        console.log(`📍 Added marker for ${container.containerCode} at [${lat}, ${lng}] - Status: ${status}`);
      }
    });

    // Fit map to show all markers if there are any
    const validContainers = containers.filter(container => {
      const lat = container.currentLocation?.lat || (container.locationLat ? parseFloat(container.locationLat) : null);
      const lng = container.currentLocation?.lng || (container.locationLng ? parseFloat(container.locationLng) : null);
      return lat && lng && lat !== 0 && lng !== 0;
    });

    if (validContainers.length > 0) {
      const bounds = window.L.latLngBounds(
        validContainers.map(container => {
          const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
          const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');
          return [lat, lng];
        })
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
    }

    console.log(`🗺️ Map updated: ${validContainers.length} containers with GPS coordinates displayed`);
  }, [containers]);

  return (
    <div className="relative z-0 bg-card border border-dashboard/20 rounded-lg p-3 lg:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 lg:mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 lg:p-2 bg-dashboard/10 rounded-lg">
            <i className="fas fa-map-marked-alt text-dashboard text-xs lg:text-sm"></i>
          </div>
          <h3 className="text-sm lg:text-lg font-semibold text-foreground">Real-time Fleet Map</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] lg:text-xs text-muted-foreground hidden sm:block">
            {stats.withGps} of {stats.total} containers tracked
          </div>
          <button className="px-2 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-xs font-medium bg-dashboard text-dashboard-foreground rounded-md hover:bg-dashboard/90 transition-smooth">
            Refresh
          </button>
        </div>
      </div>

      <div ref={mapRef} className="map-container bg-muted/10 rounded-lg flex-1 min-h-0"></div>

      <div className="mt-3 lg:mt-4 flex flex-wrap gap-2 lg:gap-4 text-[10px] lg:text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 lg:w-3 lg:h-3 bg-green-500 rounded-full"></div>
          <span className="text-muted-foreground">Active ({stats.active})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 lg:w-3 lg:h-3 bg-amber-500 rounded-full"></div>
          <span className="text-muted-foreground">Maint ({stats.maintenance})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 lg:w-3 lg:h-3 bg-red-500 rounded-full"></div>
          <span className="text-muted-foreground">Crit ({stats.critical})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 lg:w-3 lg:h-3 bg-gray-500 rounded-full"></div>
          <span className="text-muted-foreground">Offline ({stats.offline})</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto lg:ml-4">
          <div className="w-2 h-2 lg:w-3 lg:h-3 bg-blue-500 rounded-full"></div>
          <span className="text-muted-foreground">IoT ({stats.iotEnabled})</span>
        </div>
      </div>
    </div>
  );
}
