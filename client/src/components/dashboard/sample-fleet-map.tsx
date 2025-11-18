import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Eye, EyeOff } from "lucide-react";

declare global {
  interface Window {
    L: any;
  }
}

interface Container {
  id: string;
  containerCode: string;
  type: string;
  capacity: string;
  status: string;
  healthScore: number;
  excelMetadata?: {
    location?: string;
    depot?: string;
    status?: string;
    productType?: string;
    grade?: string;
    yom?: number;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  orbcommDeviceId?: string;
  hasIot: boolean;
}

interface SampleFleetMapProps {
  containers: Container[];
}

// Sample coordinates for major ports and cities
const SAMPLE_LOCATIONS = [
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Rotterdam", lat: 51.9244, lng: 4.4777 },
  { name: "Los Angeles", lat: 33.7175, lng: -118.2726 },
  { name: "Hamburg", lat: 53.5511, lng: 9.9937 },
  { name: "Antwerp", lat: 51.2194, lng: 4.4025 },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737 },
  { name: "Busan", lat: 35.1796, lng: 129.0756 },
  { name: "Long Beach", lat: 33.7701, lng: -118.1937 },
  { name: "Felixstowe", lat: 51.9486, lng: 1.3522 },
  { name: "Valencia", lat: 39.4699, lng: -0.3763 },
  { name: "Barcelona", lat: 41.3851, lng: 2.1734 },
  { name: "Genoa", lat: 44.4056, lng: 8.9463 },
  { name: "Marseille", lat: 43.2965, lng: 5.3698 },
  { name: "Le Havre", lat: 49.4944, lng: 0.1079 },
  { name: "Southampton", lat: 50.9097, lng: -1.4044 },
  { name: "Liverpool", lat: 53.4084, lng: -2.9916 },
  { name: "Bremen", lat: 53.0793, lng: 8.8017 },
  { name: "Wilhelmshaven", lat: 53.5200, lng: 8.1065 },
  { name: "Gothenburg", lat: 57.7089, lng: 11.9746 },
];

export default function SampleFleetMap({ containers }: SampleFleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [showMarkers, setShowMarkers] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  // Assign sample locations to containers
  const containersWithLocations = containers.map((container, index) => {
    const sampleLocation = SAMPLE_LOCATIONS[index % SAMPLE_LOCATIONS.length];
    return {
      ...container,
      currentLocation: {
        lat: sampleLocation.lat + (Math.random() - 0.5) * 0.1, // Add some randomness
        lng: sampleLocation.lng + (Math.random() - 0.5) * 0.1,
        address: `${sampleLocation.name} Port`
      }
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map
      mapInstanceRef.current = window.L.map(mapRef.current).setView([20.0, 0.0], 2);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    if (!showMarkers || containersWithLocations.length === 0) return;

    // Filter containers based on status
    const filteredContainers = containersWithLocations.filter(container => {
      if (filterStatus === "all") return true;
      const status = container.excelMetadata?.status || container.status;
      return status?.toLowerCase() === filterStatus.toLowerCase();
    });

    // Add markers to map
    filteredContainers.forEach(container => {
      if (!container.currentLocation) return;

      const healthScore = container.healthScore || 0;
      const status = container.excelMetadata?.status || container.status;
      
      // Determine marker color based on status and health
      let color = "#6b7280"; // Default gray
      let statusText = "Unknown";
      
      if (status?.toUpperCase() === "DEPLOYED") {
        color = healthScore >= 80 ? "#73C8D2" : healthScore >= 60 ? "#FF9013" : "#ef4444";
        statusText = "Deployed";
      } else if (status?.toUpperCase() === "SALE") {
        color = "#0046FF";
        statusText = "For Sale";
      } else if (status?.toUpperCase() === "MAINTENANCE") {
        color = "#FF9013";
        statusText = "Maintenance";
      } else if (status?.toUpperCase() === "STORAGE") {
        color = "#73C8D2";
        statusText = "Storage";
      }

      const mapMarker = window.L.circleMarker(
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

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-mono font-bold text-sm">${container.containerCode}</span>
            <span class="px-2 py-1 text-xs rounded-full" style="background-color: ${color}20; color: ${color}">
              ${statusText}
            </span>
          </div>
          <div class="space-y-1 text-xs">
            <p class="text-gray-600"><strong>Type:</strong> ${container.excelMetadata?.productType || container.type}</p>
            <p class="text-gray-600"><strong>Size:</strong> ${container.capacity}</p>
            <p class="text-gray-600"><strong>Location:</strong> ${container.currentLocation.address}</p>
            <p class="text-gray-600"><strong>Health:</strong> ${healthScore}%</p>
            <p class="text-gray-600"><strong>Grade:</strong> ${container.excelMetadata?.grade || 'N/A'}</p>
            <p class="text-gray-600"><strong>YOM:</strong> ${container.excelMetadata?.yom || 'N/A'}</p>
            <p class="text-gray-600"><strong>IoT:</strong> ${container.hasIot ? 'Enabled' : 'Manual'}</p>
          </div>
        </div>
      `;

      mapMarker.bindPopup(popupContent);
      markersRef.current.push(mapMarker);
    });

    // Fit map to show all markers
    if (filteredContainers.length > 0) {
      const group = new window.L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [containersWithLocations, filterStatus, showMarkers]);

  // Get status counts for legend
  const statusCounts = containersWithLocations.reduce((acc, container) => {
    const status = container.excelMetadata?.status || container.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Global Container Fleet Map
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (Sample Locations)
          </span>
        </CardTitle>
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkers(!showMarkers)}
            className="flex items-center gap-2"
          >
            {showMarkers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showMarkers ? 'Hide' : 'Show'} Markers
          </Button>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Containers ({containersWithLocations.length})</option>
            <option value="deployed">Deployed ({statusCounts.DEPLOYED || 0})</option>
            <option value="sale">For Sale ({statusCounts.SALE || 0})</option>
            <option value="maintenance">Maintenance ({statusCounts.MAINTENANCE || 0})</option>
            <option value="storage">Storage ({statusCounts.STORAGE || 0})</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="w-full h-96 rounded-lg border" />
        
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-muted-foreground">Deployed ({statusCounts.DEPLOYED || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-muted-foreground">For Sale ({statusCounts.SALE || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-muted-foreground">Maintenance ({statusCounts.MAINTENANCE || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-muted-foreground">Storage ({statusCounts.STORAGE || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="text-muted-foreground">Unknown ({statusCounts.unknown || 0})</span>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          <p>📍 Locations are simulated for demonstration purposes. In production, real GPS coordinates would be used.</p>
        </div>
      </CardContent>
    </Card>
  );
}







