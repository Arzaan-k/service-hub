import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/animated-card";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Eye, EyeOff, Filter, Globe, Thermometer, Battery, Zap } from "lucide-react";
import { websocket } from "@/lib/websocket";

declare global {
  interface Window {
    MapmyIndia: any;
  }
}

interface Container {
  id: string;
  containerCode: string;
  type: string;
  capacity: string;
  status: string;
  healthScore?: number;
  orbcommDeviceId?: string;
  hasIot: boolean;
  locationLat?: string;
  locationLng?: string;
  temperature?: number;
  powerStatus?: string;
  lastUpdateTimestamp?: string;
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
}

interface MapMyIndiaFleetMapProps {
  containers: Container[];
}

const MAPMYINDIA_API_KEY = import.meta.env.VITE_MAPMYINDIA_API_KEY || 'bwxdagrnmadhcoftinhpcdsgpdkzwmrkvpax';

export default function MapMyIndiaFleetMap({ containers }: MapMyIndiaFleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [showMarkers, setShowMarkers] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [containersData, setContainersData] = useState<Container[]>(containers);

  // Load Map My India scripts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if Leaflet is already loaded
      if (!window.L) {
        // Load Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);

        // Load Leaflet JS
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.async = false;
        leafletScript.onload = () => {
          console.log('Leaflet loaded');
          loadMapMyIndia();
        };
        document.head.appendChild(leafletScript);
      } else if (!window.MapmyIndia) {
        loadMapMyIndia();
      } else {
        setScriptsLoaded(true);
      }
    }

    function loadMapMyIndia() {
      if (window.MapmyIndia) {
        setScriptsLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://apis.mapmyindia.com/advancedmaps/api/${MAPMYINDIA_API_KEY}/map_sdk?layer=vector&v=3.0`;
      script.async = false;
      script.onload = () => {
        console.log('Map My India script loaded');
        setScriptsLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Map My India script');
        // Fallback to basic Leaflet if Map My India fails
        setScriptsLoaded(true);
      };
      document.head.appendChild(script);
    }
  }, []);

  // Update containers when prop changes
  useEffect(() => {
    setContainersData(containers);
  }, [containers]);

  // Listen for real-time Orbcomm updates
  useEffect(() => {
    const handleContainerUpdate = (data: any) => {
      console.log('Received container update:', data);

      setContainersData(prev => {
        return prev.map(container => {
          if (container.id === data.containerId) {
            return {
              ...container,
              locationLat: data.latitude?.toString(),
              locationLng: data.longitude?.toString(),
              temperature: data.temperature,
              powerStatus: data.powerStatus,
              lastUpdateTimestamp: data.timestamp,
              currentLocation: {
                ...container.currentLocation,
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude),
              }
            };
          }
          return container;
        });
      });
    };

    websocket.on('container_update', handleContainerUpdate);

    return () => {
      websocket.off('container_update', handleContainerUpdate);
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || !scriptsLoaded || !window.MapmyIndia) return;

    if (!mapInstanceRef.current) {
      try {
        // Initialize Map My India map centered on India
        const map = new window.MapmyIndia.Map(mapRef.current, {
          center: [20.5937, 78.9629], // India center
          zoom: 5,
          zoomControl: true,
          hybrid: false,
        });

        mapInstanceRef.current = map;
        console.log('Map My India map initialized');
      } catch (error) {
        console.error('Error initializing Map My India map:', error);
      }
    }
  }, [scriptsLoaded]);

  // Update markers when containers change
  useEffect(() => {
    if (!mapInstanceRef.current || !scriptsLoaded) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        console.warn('Error removing marker:', e);
      }
    });
    markersRef.current.clear();

    // Filter containers with valid coordinates
    const validContainers = containersData.filter(container => {
      const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
      const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');
      return lat !== 0 && lng !== 0;
    });

    console.log(`Rendering ${validContainers.length} containers with coordinates`);

    // Add new markers
    validContainers.forEach(container => {
      // Filter logic
      if (filterStatus !== "all" && container.status?.toLowerCase() !== filterStatus) return;

      const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
      const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');

      if (lat === 0 || lng === 0) return;

      try {
        // Determine marker color based on status and connectivity
        let markerColor = '#6B7280'; // Default gray
        if (container.orbcommDeviceId) {
          // Orbcomm connected - use status-based colors
          if (container.temperature && container.temperature > 30) {
            markerColor = '#EF4444'; // Red for high temperature
          } else if (container.powerStatus === 'off') {
            markerColor = '#F97316'; // Orange for power off
          } else {
            markerColor = '#10B981'; // Green for normal
          }
        } else if (container.hasIot) {
          markerColor = '#3B82F6'; // Blue for IoT (non-Orbcomm)
        }

        // Create custom marker icon with telemetry indicators
        const markerHtml = `
          <div style="position: relative;">
            <div style="
              background-color: ${markerColor};
              width: 16px;
              height: 16px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            "></div>
            ${container.orbcommDeviceId ? `
              <div style="
                position: absolute;
                top: -4px;
                right: -4px;
                width: 8px;
                height: 8px;
                background-color: ${container.temperature && container.temperature > 30 ? '#EF4444' : '#10B981'};
                border-radius: 50%;
                border: 1px solid white;
                animation: pulse 2s infinite;
              "></div>
            ` : ''}
          </div>
        `;

        // Create div icon
        const icon = window.L.divIcon({
          className: 'custom-marker',
          html: markerHtml,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        // Create popup content
        const lastUpdate = container.lastUpdateTimestamp
          ? new Date(container.lastUpdateTimestamp).toLocaleString()
          : 'N/A';

        const popupContent = `
          <div class="p-3 min-w-[250px]">
            <h3 class="font-bold text-base mb-2">${container.containerCode}</h3>
            <div class="text-sm space-y-2">
              <p><span class="text-gray-600">Type:</span> <span class="font-medium">${container.type || 'N/A'}</span></p>
              <p><span class="text-gray-600">Status:</span> <span class="capitalize font-medium">${container.status || 'unknown'}</span></p>

              ${container.orbcommDeviceId ? `
                <div class="mt-3 pt-2 border-t border-gray-200">
                  <div class="flex items-center gap-2 text-green-600 font-medium mb-2">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="3"/>
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1"/>
                    </svg>
                    Orbcomm Connected
                  </div>

                  ${container.temperature !== undefined ? `
                    <p class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                      </svg>
                      <span class="text-gray-600">Temperature:</span>
                      <span class="font-medium ${container.temperature > 30 ? 'text-red-600' : 'text-gray-900'}">${container.temperature.toFixed(1)}°C</span>
                    </p>
                  ` : ''}

                  ${container.powerStatus ? `
                    <p class="flex items-center gap-2">
                      <svg class="w-4 h-4 ${container.powerStatus === 'on' ? 'text-green-500' : 'text-red-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      <span class="text-gray-600">Power:</span>
                      <span class="font-medium ${container.powerStatus === 'on' ? 'text-green-600' : 'text-red-600'} uppercase">${container.powerStatus}</span>
                    </p>
                  ` : ''}

                  <p class="text-xs text-gray-500 mt-2">Last update: ${lastUpdate}</p>
                </div>
              ` : container.hasIot ? `
                <span class="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium mt-2">IoT Connected</span>
              ` : `
                <span class="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium mt-2">Manual Tracking</span>
              `}
            </div>
          </div>
        `;

        // Create marker using Map My India
        const marker = window.L.marker([lat, lng], { icon });
        marker.bindPopup(popupContent);
        marker.addTo(map);

        // Store marker reference
        markersRef.current.set(container.id, marker);
      } catch (error) {
        console.error(`Error adding marker for ${container.containerCode}:`, error);
      }
    });

    // Fit map to show all markers
    if (validContainers.length > 0 && markersRef.current.size > 0) {
      try {
        const bounds = window.L.latLngBounds(
          Array.from(markersRef.current.values()).map((marker: any) => marker.getLatLng())
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }

  }, [containersData, filterStatus, scriptsLoaded]);

  // Get statistics
  const orbcommConnected = containersData.filter(c => c.orbcommDeviceId).length;
  const iotConnected = containersData.filter(c => c.hasIot && !c.orbcommDeviceId).length;
  const manual = containersData.filter(c => !c.hasIot && !c.orbcommDeviceId).length;

  return (
    <GlassCard className="h-full w-full p-0 overflow-hidden flex flex-col relative">
      {/* Map Actions */}
      <div className="absolute top-4 right-4 z-[400] flex gap-2">
        <div className="bg-white/90 backdrop-blur shadow-sm rounded-lg p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([20.5937, 78.9629], 5);
              }
            }}
            title="Reset view"
          >
            <Globe className="h-4 w-4" />
          </Button>
        </div>

        {/* Status filter */}
        <div className="bg-white/90 backdrop-blur shadow-sm rounded-lg p-1 flex gap-1">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus('all')}
            className="h-8 text-xs"
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'operational' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus('operational')}
            className="h-8 text-xs"
          >
            Active
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Live Fleet Map</h3>
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Orbcomm: <strong>{orbcommConnected}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>IoT: <strong>{iotConnected}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
              <span>Manual: <strong>{manual}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapRef} className="flex-1 w-full bg-muted/20" />

      {/* Add CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }
      `}</style>
    </GlassCard>
  );
}
