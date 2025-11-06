import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw, Filter, Eye, EyeOff } from "lucide-react";

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

interface EnhancedFleetMapProps {
  containers: Container[];
}

interface ContainerMarker {
  container: Container;
  lat: number;
  lng: number;
  address: string;
}

export default function EnhancedFleetMap({ containers }: EnhancedFleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showMarkers, setShowMarkers] = useState(true);
  const [containerMarkers, setContainerMarkers] = useState<ContainerMarker[]>([]);

  // Geocoding function to convert location strings to coordinates
  const geocodeLocation = async (location: string, depot?: string): Promise<{ lat: number; lng: number; address: string } | null> => {
    try {
      const query = `${location} ${depot || ''}`.trim();
      // Use our proxy endpoint to avoid CORS issues
      const response = await apiRequest("GET", `/api/proxy/nominatim?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Process containers and geocode locations
  useEffect(() => {
    const processContainers = async () => {
      if (!containers || containers.length === 0) return;
      
      setIsLoading(true);
      const markers: ContainerMarker[] = [];
      
      // Process containers with existing coordinates first
      const containersWithCoords = containers.filter(c => 
        c.currentLocation?.lat && c.currentLocation?.lng
      );
      
      containersWithCoords.forEach(container => {
        if (container.currentLocation) {
          markers.push({
            container,
            lat: container.currentLocation.lat,
            lng: container.currentLocation.lng,
            address: container.currentLocation.address || 'Unknown location'
          });
        }
      });

      // Process containers that need geocoding (limit to first 50 for performance)
      const containersToGeocode = containers
        .filter(c => !c.currentLocation?.lat && c.excelMetadata?.location)
        .slice(0, 50);

      for (const container of containersToGeocode) {
        const coords = await geocodeLocation(
          container.excelMetadata?.location || '',
          container.excelMetadata?.depot
        );
        
        if (coords) {
          markers.push({
            container,
            lat: coords.lat,
            lng: coords.lng,
            address: coords.address
          });
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setContainerMarkers(markers);
      setIsLoading(false);
    };

    processContainers();
  }, [containers]);

  // Initialize map and add markers
  useEffect(() => {
    if (typeof window === "undefined" || !window.L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map with a default center (can be adjusted based on data)
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

    if (!showMarkers || containerMarkers.length === 0) return;

    // Filter markers based on status
    const filteredMarkers = containerMarkers.filter(marker => {
      if (filterStatus === "all") return true;
      const status = marker.container.excelMetadata?.status || marker.container.status;
      return status?.toLowerCase() === filterStatus.toLowerCase();
    });

    // Add markers to map
    filteredMarkers.forEach(marker => {
      const container = marker.container;
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
        [marker.lat, marker.lng],
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
            <p class="text-gray-600"><strong>Location:</strong> ${marker.address}</p>
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
    if (filteredMarkers.length > 0) {
      const group = new window.L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [containerMarkers, filterStatus, showMarkers]);

  // Get status counts for legend
  const statusCounts = containerMarkers.reduce((acc, marker) => {
    const status = marker.container.excelMetadata?.status || marker.container.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Global Container Fleet Map
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
            <option value="all">All Containers ({containerMarkers.length})</option>
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
        {isLoading && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading container locations...</p>
            </div>
          </div>
        )}
        
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
      </CardContent>
    </Card>
  );
}







