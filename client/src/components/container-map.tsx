import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ExternalLink } from "lucide-react";

interface ContainerMapProps {
  location?: string;
  depot?: string;
  containerCode: string;
  lat?: number;
  lng?: number;
}

export default function ContainerMap({ location, depot, containerCode, lat, lng }: ContainerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // If we have coordinates, we can render a real map iframe or a link to it
    // For now, we'll keep the visual style but update the link and text

    if (!location && (!lat || !lng)) return;

    // Create a simple map representation
    const mapElement = mapRef.current;

    // Clear previous content
    mapElement.innerHTML = '';

    // Create map container
    const mapContainer = document.createElement('div');
    mapContainer.style.width = '100%';
    mapContainer.style.height = '300px';
    mapContainer.style.borderRadius = '8px';
    mapContainer.style.position = 'relative';
    mapContainer.style.overflow = 'hidden';

    // If we have coordinates, use an iframe for a real map
    if (lat && lng) {
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.style.border = '0';
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      // Use Google Maps Embed API (free mode with q parameter)
      iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
      mapContainer.appendChild(iframe);
    } else {
      // Fallback to gradient placeholder
      mapContainer.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
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
      locationText.textContent = location || 'Unknown Location';

      mapContainer.appendChild(pinElement);
      mapContainer.appendChild(locationText);

      // Add click handler to open in Google Maps
      const openInMaps = () => {
        const query = encodeURIComponent(`${location} ${depot || ''}`.trim());
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      };

      mapContainer.style.cursor = 'pointer';
      mapContainer.addEventListener('click', openInMaps);

      // Cleanup listener on unmount is handled by useEffect return
      // But since we are creating elements dynamically inside useEffect, 
      // we need to attach the cleanup to the element or return a cleanup function that references the element
      // However, since we clear innerHTML at the start, previous listeners are removed with the elements
    }

    // Create depot text overlay if available (even for iframe)
    if (depot && (lat && lng)) {
      const depotText = document.createElement('div');
      depotText.style.position = 'absolute';
      depotText.style.bottom = '10px';
      depotText.style.left = '10px';
      depotText.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      depotText.style.padding = '4px 8px';
      depotText.style.borderRadius = '4px';
      depotText.style.fontSize = '12px';
      depotText.style.fontWeight = 'bold';
      depotText.style.color = '#333';
      depotText.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      depotText.textContent = `Depot: ${depot}`;
      mapContainer.appendChild(depotText);
    } else if (depot && !lat) {
      // Handled in the else block above for gradient view
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

    mapElement.appendChild(mapContainer);

    return () => {
      // Cleanup if needed
    };
  }, [location, depot, lat, lng]);

  if (!location && !lat) {
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
            {lat && lng ? "Real-time location from Orbcomm" : "Click on the map to open in Google Maps"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}



































