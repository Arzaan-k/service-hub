import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Globe } from "lucide-react";
import { websocket } from "@/lib/websocket";

declare global {
  interface Window {
    MapmyIndia: any;
    L: any;
  }
}

interface Container {
  id: string;
  containerCode: string;
  type: string;
  status: string;
  orbcommDeviceId?: string;
  hasIot: boolean;
  locationLat?: string;
  locationLng?: string;
  temperature?: number;
  powerStatus?: string;
  lastUpdateTimestamp?: string;
  currentLocation?: {
    lat: number;
    lng: number;
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
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [containersData, setContainersData] = useState<Container[]>(containers);

  // Load Map My India scripts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadScripts = async () => {
      // Load Leaflet CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);
      }

      // Load Leaflet JS
      if (!window.L) {
        await new Promise<void>((resolve) => {
          const leafletScript = document.createElement('script');
          leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          leafletScript.onload = () => {
            console.log('Leaflet loaded');
            resolve();
          };
          document.head.appendChild(leafletScript);
        });
      }

      // Load Map My India
      if (!window.MapmyIndia) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = `https://apis.mapmyindia.com/advancedmaps/api/${MAPMYINDIA_API_KEY}/map_sdk?layer=vector&v=3.0`;
          script.onload = () => {
            console.log('Map My India loaded');
            resolve();
          };
          script.onerror = () => {
            console.error('Failed to load Map My India');
            resolve(); // Continue anyway with Leaflet
          };
          document.head.appendChild(script);
        });
      }

      setScriptsLoaded(true);
    };

    loadScripts();
  }, []);

  // Update containers data
  useEffect(() => {
    setContainersData(containers);
  }, [containers]);

  // Listen for real-time updates
  useEffect(() => {
    const handleContainerUpdate = (data: any) => {
      setContainersData(prev => prev.map(container => {
        if (container.id === data.containerId) {
          return {
            ...container,
            locationLat: data.latitude?.toString(),
            locationLng: data.longitude?.toString(),
            temperature: data.temperature,
            powerStatus: data.powerStatus,
            lastUpdateTimestamp: data.timestamp,
            currentLocation: data.latitude && data.longitude ? {
              lat: parseFloat(data.latitude),
              lng: parseFloat(data.longitude),
            } : container.currentLocation
          };
        }
        return container;
      }));
    };

    websocket.on('container_update', handleContainerUpdate);
    return () => websocket.off('container_update', handleContainerUpdate);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !scriptsLoaded || !window.MapmyIndia || mapInstanceRef.current) return;

    try {
      const map = new window.MapmyIndia.Map(mapRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true,
        hybrid: false,
      });

      mapInstanceRef.current = map;
      console.log('Map initialized');
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [scriptsLoaded]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !scriptsLoaded || !window.L) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Add new markers
    const validContainers = containersData.filter(container => {
      const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
      const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');
      return lat !== 0 && lng !== 0;
    });

    validContainers.forEach(container => {
      const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
      const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');

      // Determine color
      let color = '#9CA3AF'; // gray
      if (container.orbcommDeviceId) {
        if (container.temperature && container.temperature > 30) {
          color = '#EF4444'; // red
        } else if (container.powerStatus === 'off') {
          color = '#F97316'; // orange
        } else {
          color = '#10B981'; // green
        }
      } else if (container.hasIot) {
        color = '#3B82F6'; // blue
      }

      const icon = window.L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const popupContent = `
        <div class="p-3 min-w-[250px]">
          <h3 class="font-bold text-base mb-2">${container.containerCode}</h3>
          <div class="text-sm space-y-2">
            <p><span class="text-gray-600">Type:</span> <span class="font-medium">${container.type || 'N/A'}</span></p>
            <p><span class="text-gray-600">Status:</span> <span class="capitalize font-medium">${container.status || 'unknown'}</span></p>
            ${container.temperature !== undefined ? `
              <p><span class="text-gray-600">Temperature:</span> <span class="font-medium ${container.temperature > 30 ? 'text-red-600' : 'text-gray-900'}">${container.temperature.toFixed(1)}°C</span></p>
            ` : ''}
            ${container.powerStatus ? `
              <p><span class="text-gray-600">Power:</span> <span class="font-medium ${container.powerStatus === 'on' ? 'text-green-600' : 'text-red-600'} uppercase">${container.powerStatus}</span></p>
            ` : ''}
          </div>
        </div>
      `;

      const marker = window.L.marker([lat, lng], { icon });
      marker.bindPopup(popupContent);
      marker.addTo(map);
      markersRef.current.set(container.id, marker);
    });

    // Fit bounds
    if (validContainers.length > 0) {
      const bounds = window.L.latLngBounds(
        validContainers.map(c => {
          const lat = c.currentLocation?.lat || parseFloat(c.locationLat || '0');
          const lng = c.currentLocation?.lng || parseFloat(c.locationLng || '0');
          return [lat, lng];
        })
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [containersData, scriptsLoaded]);

  const orbcommConnected = containersData.filter(c => c.orbcommDeviceId).length;
  const iotConnected = containersData.filter(c => c.hasIot && !c.orbcommDeviceId).length;
  const manual = containersData.filter(c => !c.hasIot && !c.orbcommDeviceId).length;

  return (
    <div className="h-full w-full flex flex-col bg-card/40 backdrop-blur-2xl border border-border rounded-[2rem] relative overflow-hidden">
      {/* Glass effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent opacity-40 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Reset button */}
        <div className="absolute top-4 right-4 z-[400]">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/90 backdrop-blur shadow-sm"
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

        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-white/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Live Fleet Map</h3>
          </div>
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

        {/* Map */}
        <div ref={mapRef} className="flex-1 min-h-0 bg-muted/20" />
      </div>

      <style>{`
        .leaflet-container {
          height: 100%;
          width: 100%;
          z-index: 1;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
