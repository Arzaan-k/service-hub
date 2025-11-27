import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Globe } from "lucide-react";
import { websocket } from "@/lib/websocket";

declare global {
  interface Window {
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

interface FleetMapProps {
  containers: Container[];
}

export default function FleetMap({ containers }: FleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [containersData, setContainersData] = useState<Container[]>(containers);

  // Load Map My India scripts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadScripts = async () => {
      console.log('🔄 Loading map scripts...');

      // Load Leaflet CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);
        console.log('📦 Leaflet CSS added');
      }

      // Load Leaflet JS
      if (!window.L) {
        await new Promise<void>((resolve) => {
          const leafletScript = document.createElement('script');
          leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          leafletScript.onload = () => {
            console.log('✅ Leaflet JS loaded');
            resolve();
          };
          leafletScript.onerror = () => {
            console.error('❌ Failed to load Leaflet JS');
            resolve();
          };
          document.head.appendChild(leafletScript);
        });
      } else {
        console.log('✅ Leaflet JS already loaded');
      }

      console.log('✅ Leaflet loaded, ready to initialize');
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
      console.log('🔄 Received container update:', data);
      setContainersData(prev => prev.map(container => {
        if (container.id === data.data?.containerId || container.id === data.containerId) {
          const updateData = data.data || data;
          return {
            ...container,
            locationLat: updateData.latitude?.toString() || container.locationLat,
            locationLng: updateData.longitude?.toString() || container.locationLng,
            temperature: updateData.temperature !== undefined ? updateData.temperature : container.temperature,
            powerStatus: updateData.powerStatus || container.powerStatus,
            lastUpdateTimestamp: updateData.timestamp || new Date().toISOString(),
            currentLocation: updateData.latitude && updateData.longitude ? {
              lat: parseFloat(updateData.latitude),
              lng: parseFloat(updateData.longitude),
            } : container.currentLocation
          };
        }
        return container;
      }));
    };

    const handleAlertCreated = (data: any) => {
      console.log('🚨 Received alert:', data);
      // Alerts will trigger container updates through the container_update event
    };

    websocket.on('container_update', handleContainerUpdate);
    websocket.on('alert_created', handleAlertCreated);

    return () => {
      websocket.off('container_update', handleContainerUpdate);
      websocket.off('alert_created', handleAlertCreated);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !scriptsLoaded || mapInstanceRef.current) return;

    try {
      console.log('🗺️ Initializing OpenStreetMap...');

      const map = window.L.map(mapRef.current).setView([20.5937, 78.9629], 5);

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      console.log('✅ OpenStreetMap initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing OpenStreetMap:', error);
    }
  }, [scriptsLoaded]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !scriptsLoaded || !window.L) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    console.log('📍 Total containers received:', containersData.length);

    // Add new markers
    const validContainers = containersData.filter(container => {
      const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
      const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');
      const isValid = lat !== 0 && lng !== 0;

      if (!isValid && container.orbcommDeviceId) {
        console.log(`⚠️  Container ${container.containerCode} has Orbcomm device but no GPS:`, {
          locationLat: container.locationLat,
          locationLng: container.locationLng,
          currentLocation: container.currentLocation
        });
      }

      return isValid;
    });

    console.log('📍 Valid containers with GPS:', validContainers.length);

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
        <div ref={mapRef} className="flex-1 min-h-0 bg-muted/20 relative">
          {!scriptsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}
          {scriptsLoaded && !mapInstanceRef.current && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <MapPin className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Map failed to initialize</p>
                <p className="text-xs text-muted-foreground mt-1">Check console for errors</p>
              </div>
            </div>
          )}
        </div>
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
