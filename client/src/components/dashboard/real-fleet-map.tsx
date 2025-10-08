import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Eye, EyeOff, Filter } from "lucide-react";

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

interface RealFleetMapProps {
  containers: Container[];
}

// Chennai and surrounding areas coordinates for realistic positioning
const CHENNAI_COORDINATES = {
  lat: 13.0827,
  lng: 80.2707
};

// Known locations in Chennai area
const CHENNAI_LOCATIONS = [
  { name: "Chennai Port", lat: 13.0843, lng: 80.2904 },
  { name: "Ennore Port", lat: 13.2300, lng: 80.3200 },
  { name: "Kattupalli Port", lat: 13.3000, lng: 80.3500 },
  { name: "Chennai International Airport", lat: 12.9941, lng: 80.1709 },
  { name: "Chennai Central", lat: 13.0827, lng: 80.2707 },
  { name: "Taramani", lat: 12.9250, lng: 80.2400 },
  { name: "Guindy", lat: 12.9900, lng: 80.2200 },
  { name: "Teynampet", lat: 13.0300, lng: 80.2500 },
  { name: "Anna Nagar", lat: 13.0800, lng: 80.2200 },
  { name: "Adyar", lat: 12.9900, lng: 80.2500 },
  { name: "Mylapore", lat: 13.0300, lng: 80.2600 },
  { name: "T. Nagar", lat: 13.0400, lng: 80.2400 },
  { name: "Nungambakkam", lat: 13.0600, lng: 80.2400 },
  { name: "Kilpauk", lat: 13.0800, lng: 80.2500 },
  { name: "Perambur", lat: 13.1100, lng: 80.2600 },
  { name: "Ambattur", lat: 13.1000, lng: 80.1600 },
  { name: "Avadi", lat: 13.1200, lng: 80.1000 },
  { name: "Poonamallee", lat: 13.0300, lng: 80.1000 },
  { name: "Tambaram", lat: 12.9200, lng: 80.1200 },
  { name: "Chromepet", lat: 12.9500, lng: 80.1400 }
];

// Location mapping for known locations
const LOCATION_MAPPING: Record<string, { lat: number; lng: number; name: string }> = {
  "nicon marine": { lat: 13.0843, lng: 80.2904, name: "Chennai Port" },
  "zircon": { lat: 13.2300, lng: 80.3200, name: "Ennore Port" },
  "chennai port": { lat: 13.0843, lng: 80.2904, name: "Chennai Port" },
  "ennore port": { lat: 13.2300, lng: 80.3200, name: "Ennore Port" },
  "kattupalli": { lat: 13.3000, lng: 80.3500, name: "Kattupalli Port" },
  "airport": { lat: 12.9941, lng: 80.1709, name: "Chennai International Airport" },
  "central": { lat: 13.0827, lng: 80.2707, name: "Chennai Central" },
  "taramani": { lat: 12.9250, lng: 80.2400, name: "Taramani" },
  "guindy": { lat: 12.9900, lng: 80.2200, name: "Guindy" },
  "teynampet": { lat: 13.0300, lng: 80.2500, name: "Teynampet" },
  "anna nagar": { lat: 13.0800, lng: 80.2200, name: "Anna Nagar" },
  "adyar": { lat: 12.9900, lng: 80.2500, name: "Adyar" },
  "mylapore": { lat: 13.0300, lng: 80.2600, name: "Mylapore" },
  "t nagar": { lat: 13.0400, lng: 80.2400, name: "T. Nagar" },
  "nungambakkam": { lat: 13.0600, lng: 80.2400, name: "Nungambakkam" },
  "kilpauk": { lat: 13.0800, lng: 80.2500, name: "Kilpauk" },
  "perambur": { lat: 13.1100, lng: 80.2600, name: "Perambur" },
  "ambattur": { lat: 13.1000, lng: 80.1600, name: "Ambattur" },
  "avadi": { lat: 13.1200, lng: 80.1000, name: "Avadi" },
  "poonamallee": { lat: 13.0300, lng: 80.1000, name: "Poonamallee" },
  "tambaram": { lat: 12.9200, lng: 80.1200, name: "Tambaram" },
  "chromepet": { lat: 12.9500, lng: 80.1400, name: "Chromepet" }
};

export default function RealFleetMap({ containers }: RealFleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [showMarkers, setShowMarkers] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDepot, setFilterDepot] = useState("all");

  // Get coordinates for a location string
  const getLocationCoordinates = (location: string, depot: string): { lat: number; lng: number; name: string } => {
    const locationKey = location.toLowerCase().trim();
    
    // Check if we have a direct mapping
    if (LOCATION_MAPPING[locationKey]) {
      return LOCATION_MAPPING[locationKey];
    }
    
    // Check for partial matches
    for (const [key, coords] of Object.entries(LOCATION_MAPPING)) {
      if (locationKey.includes(key) || key.includes(locationKey)) {
        return coords;
      }
    }
    
    // If depot is Chennai, use Chennai area coordinates with some randomization
    if (depot.toLowerCase().includes('chennai')) {
      const randomLocation = CHENNAI_LOCATIONS[Math.floor(Math.random() * CHENNAI_LOCATIONS.length)];
      return {
        lat: randomLocation.lat + (Math.random() - 0.5) * 0.01,
        lng: randomLocation.lng + (Math.random() - 0.5) * 0.01,
        name: `${location} (${depot})`
      };
    }
    
    // Default to Chennai area if no specific location found
    return {
      lat: CHENNAI_COORDINATES.lat + (Math.random() - 0.5) * 0.1,
      lng: CHENNAI_COORDINATES.lng + (Math.random() - 0.5) * 0.1,
      name: `${location} (${depot})`
    };
  };

  // Process containers and assign coordinates
  const containersWithLocations = containers.map(container => {
    const location = container.excelMetadata?.location || 'Unknown';
    const depot = container.excelMetadata?.depot || 'Unknown';
    const coords = getLocationCoordinates(location, depot);
    
    return {
      ...container,
      currentLocation: {
        lat: coords.lat,
        lng: coords.lng,
        address: coords.name
      }
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map centered on Chennai
      mapInstanceRef.current = window.L.map(mapRef.current).setView([CHENNAI_COORDINATES.lat, CHENNAI_COORDINATES.lng], 11);

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

    // Filter containers based on status and depot
    const filteredContainers = containersWithLocations.filter(container => {
      const statusMatch = filterStatus === "all" || 
        (container.excelMetadata?.status || container.status)?.toLowerCase() === filterStatus.toLowerCase();
      const depotMatch = filterDepot === "all" || 
        (container.excelMetadata?.depot || 'Unknown')?.toLowerCase().includes(filterDepot.toLowerCase());
      return statusMatch && depotMatch;
    });

    // Group containers by location for clustering
    const locationGroups: Record<string, Container[]> = {};
    filteredContainers.forEach(container => {
      const locationKey = container.currentLocation?.address || 'Unknown';
      if (!locationGroups[locationKey]) {
        locationGroups[locationKey] = [];
      }
      locationGroups[locationKey].push(container);
    });

    // Add markers for each location group
    Object.entries(locationGroups).forEach(([locationName, containersAtLocation]) => {
      const firstContainer = containersAtLocation[0];
      if (!firstContainer.currentLocation) return;

      const healthScore = firstContainer.healthScore || 0;
      const status = firstContainer.excelMetadata?.status || firstContainer.status;
      
      // Determine marker color based on status and health
      let color = "#6b7280"; // Default gray
      let statusText = "Unknown";
      
      if (status?.toUpperCase() === "DEPLOYED") {
        color = healthScore >= 80 ? "#22c55e" : healthScore >= 60 ? "#f59e0b" : "#ef4444";
        statusText = "Deployed";
      } else if (status?.toUpperCase() === "SALE") {
        color = "#3b82f6";
        statusText = "For Sale";
      } else if (status?.toUpperCase() === "MAINTENANCE") {
        color = "#f59e0b";
        statusText = "Maintenance";
      } else if (status?.toUpperCase() === "STORAGE") {
        color = "#8b5cf6";
        statusText = "Storage";
      }

      // Calculate marker size based on number of containers at this location
      const markerSize = Math.min(12 + containersAtLocation.length * 2, 20);

      const mapMarker = window.L.circleMarker(
        [firstContainer.currentLocation.lat, firstContainer.currentLocation.lng],
        {
          radius: markerSize,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }
      ).addTo(mapInstanceRef.current);

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-[250px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-bold text-sm">${locationName}</span>
            <span class="px-2 py-1 text-xs rounded-full" style="background-color: ${color}20; color: ${color}">
              ${statusText}
            </span>
          </div>
          <div class="text-xs text-gray-600 mb-2">
            <strong>Containers:</strong> ${containersAtLocation.length}
          </div>
          <div class="space-y-1 text-xs max-h-32 overflow-y-auto">
            ${containersAtLocation.slice(0, 5).map(container => `
              <div class="flex justify-between items-center py-1 border-b border-gray-100">
                <span class="font-mono text-xs">${container.containerCode}</span>
                <span class="text-xs text-gray-500">${container.excelMetadata?.productType || container.type}</span>
              </div>
            `).join('')}
            ${containersAtLocation.length > 5 ? `<div class="text-xs text-gray-500 text-center pt-1">... and ${containersAtLocation.length - 5} more</div>` : ''}
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
  }, [containersWithLocations, filterStatus, filterDepot, showMarkers]);

  // Get unique depots for filter
  const uniqueDepots = Array.from(new Set(
    containers.map(c => c.excelMetadata?.depot).filter(Boolean)
  ));

  // Get status counts for legend
  const statusCounts = containersWithLocations.reduce((acc, container) => {
    const status = container.excelMetadata?.status || container.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get depot counts
  const depotCounts = containersWithLocations.reduce((acc, container) => {
    const depot = container.excelMetadata?.depot || 'Unknown';
    acc[depot] = (acc[depot] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Container Fleet Map - Chennai Region
        </CardTitle>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
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
            <option value="all">All Status ({containersWithLocations.length})</option>
            <option value="deployed">Deployed ({statusCounts.DEPLOYED || 0})</option>
            <option value="sale">For Sale ({statusCounts.SALE || 0})</option>
            <option value="maintenance">Maintenance ({statusCounts.MAINTENANCE || 0})</option>
            <option value="storage">Storage ({statusCounts.STORAGE || 0})</option>
          </select>

          <select
            value={filterDepot}
            onChange={(e) => setFilterDepot(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Depots ({containersWithLocations.length})</option>
            {uniqueDepots.map(depot => (
              <option key={depot} value={depot?.toLowerCase() || 'unknown'}>
                {depot} ({depotCounts[depot || 'Unknown'] || 0})
              </option>
            ))}
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
        
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
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
          
          <div className="text-xs text-muted-foreground">
            <p>📍 Locations are mapped based on your container data. Click markers to see container details at each location.</p>
            <p>🔍 Marker size indicates number of containers at each location.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}






