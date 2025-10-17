import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ExternalLink } from "lucide-react";

interface ContainerMapProps {
  location?: string;
  depot?: string;
  containerCode: string;
}

export default function ContainerMap({ location, depot, containerCode }: ContainerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || !location) return;

    // Create a simple map representation
    const mapElement = mapRef.current;
    
    // Clear previous content
    mapElement.innerHTML = '';

    // Create map container
    const mapContainer = document.createElement('div');
    mapContainer.style.width = '100%';
    mapContainer.style.height = '300px';
    mapContainer.style.borderRadius = '8px';
    mapContainer.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    mapContainer.style.position = 'relative';
    mapContainer.style.overflow = 'hidden';
    mapContainer.style.display = 'flex';
    mapContainer.style.alignItems = 'center';
    mapContainer.style.justifyContent = 'center';
    mapContainer.style.color = 'white';

    // Create location pin
    const pinElement = document.createElement('div');
    pinElement.style.position = 'absolute';
    pinElement.style.top = '50%';
    pinElement.style.left = '50%';
    pinElement.style.transform = 'translate(-50%, -50%)';
    pinElement.style.fontSize = '48px';
    pinElement.style.textAlign = 'center';
    pinElement.innerHTML = '📍';

    // Create location text
    const locationText = document.createElement('div');
    locationText.style.position = 'absolute';
    locationText.style.bottom = '20px';
    locationText.style.left = '20px';
    locationText.style.right = '20px';
    locationText.style.textAlign = 'center';
    locationText.style.fontSize = '16px';
    locationText.style.fontWeight = 'bold';
    locationText.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
    locationText.textContent = location;

    // Create depot text if available
    if (depot) {
      const depotText = document.createElement('div');
      depotText.style.position = 'absolute';
      depotText.style.bottom = '50px';
      depotText.style.left = '20px';
      depotText.style.right = '20px';
      depotText.style.textAlign = 'center';
      depotText.style.fontSize = '14px';
      depotText.style.opacity = '0.9';
      depotText.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
      depotText.textContent = `Depot: ${depot}`;
      mapContainer.appendChild(depotText);
    }

    mapContainer.appendChild(pinElement);
    mapContainer.appendChild(locationText);
    mapElement.appendChild(mapContainer);

    // Add click handler to open in Google Maps
    const openInMaps = () => {
      const query = encodeURIComponent(`${location} ${depot || ''}`.trim());
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    };

    mapContainer.style.cursor = 'pointer';
    mapContainer.addEventListener('click', openInMaps);

    return () => {
      mapContainer.removeEventListener('click', openInMaps);
    };
  }, [location, depot]);

  if (!location) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No location information available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="w-full" />
        <div className="mt-3 text-center">
          <p className="text-sm text-muted-foreground">
            Click on the map to open in Google Maps
          </p>
        </div>
      </CardContent>
    </Card>
  );
}




















