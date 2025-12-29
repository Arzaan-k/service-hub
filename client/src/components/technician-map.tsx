import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, MapPin, Users, Wifi, WifiOff, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

declare global {
    interface Window {
        L: any;
    }
}

interface TechnicianLocation {
    technicianId: string;
    userId: string;
    name: string;
    email: string;
    latitude: number;
    longitude: number;
    speed?: number;
    batteryLevel?: number;
    address?: string;
    lastSeen: string;
    status: "online" | "idle" | "offline";
}

export default function TechnicianMap() {
    const mapRef = useRef<any>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());
    const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);

    // Fetch technician locations from the LocTrack API
    const { data: technicians = [], isLoading, refetch, isFetching } = useQuery<TechnicianLocation[]>({
        queryKey: ["/api/technicians/live-locations"],
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    useEffect(() => {
        if (typeof window === "undefined" || !window.L) return;

        if (!mapInstanceRef.current && mapRef.current) {
            // Initialize map centered on India
            mapInstanceRef.current = window.L.map(mapRef.current).setView([20.5937, 78.9629], 5);

            window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
                attribution: "© OpenStreetMap contributors, © CARTO",
            }).addTo(mapInstanceRef.current);
        }

        if (!mapInstanceRef.current) return;

        // Update/Add markers
        technicians.forEach((tech) => {
            if (!tech.latitude || !tech.longitude) return;

            const statusColor = {
                online: "#22c55e",
                idle: "#eab308",
                offline: "#94a3b8",
            }[tech.status];

            const initials = tech.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

            // Create custom icon
            const icon = window.L.divIcon({
                className: "custom-technician-marker",
                html: `
          <div style="
            width: 36px;
            height: 36px;
            background: white;
            border: 3px solid ${statusColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            color: #374151;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          ">
            ${initials}
          </div>
        `,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });

            const existingMarker = markersRef.current.get(tech.technicianId);

            if (existingMarker) {
                // Update position
                existingMarker.setLatLng([tech.latitude, tech.longitude]);
                existingMarker.setIcon(icon);
            } else {
                // Create new marker
                const marker = window.L.marker([tech.latitude, tech.longitude], { icon })
                    .addTo(mapInstanceRef.current)
                    .on("click", () => setSelectedTechnician(tech));

                markersRef.current.set(tech.technicianId, marker);
            }
        });

        // Remove markers for technicians no longer in the list
        const currentIds = new Set(technicians.map((t) => t.technicianId));
        markersRef.current.forEach((marker, id) => {
            if (!currentIds.has(id)) {
                mapInstanceRef.current.removeLayer(marker);
                markersRef.current.delete(id);
            }
        });

        // Fit bounds if we have technicians
        if (technicians.length > 0) {
            const validTechs = technicians.filter((t) => t.latitude && t.longitude);
            if (validTechs.length > 0) {
                const bounds = window.L.latLngBounds(
                    validTechs.map((t) => [t.latitude, t.longitude])
                );
                mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
            }
        }
    }, [technicians]);

    const stats = {
        total: technicians.length,
        online: technicians.filter((t) => t.status === "online").length,
        idle: technicians.filter((t) => t.status === "idle").length,
        offline: technicians.filter((t) => t.status === "offline").length,
    };

    return (
        <div className="space-y-4">
            {/* Stats Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">Live Technician Tracking</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <Badge variant="default" className="gap-1 bg-green-500">
                            <Wifi className="h-3 w-3" />
                            Online: {stats.online}
                        </Badge>
                        <Badge variant="secondary" className="gap-1 bg-yellow-500 text-white">
                            <Clock className="h-3 w-3" />
                            Idle: {stats.idle}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                            <WifiOff className="h-3 w-3" />
                            Offline: {stats.offline}
                        </Badge>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Map Card */}
            <Card>
                <CardContent className="p-0 relative">
                    {isLoading ? (
                        <Skeleton className="h-[500px] w-full rounded-lg" />
                    ) : (
                        <>
                            <div
                                ref={mapRef}
                                className="h-[500px] w-full rounded-lg"
                                style={{ zIndex: 0 }}
                            />

                            {/* Selected Technician Info */}
                            {selectedTechnician && (
                                <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border rounded-lg shadow-lg p-4 z-[1000]">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${selectedTechnician.status === "online"
                                                        ? "bg-green-500"
                                                        : selectedTechnician.status === "idle"
                                                            ? "bg-yellow-500"
                                                            : "bg-gray-400"
                                                    }`}
                                            >
                                                {selectedTechnician.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")
                                                    .substring(0, 2)
                                                    .toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{selectedTechnician.name}</h4>
                                                <p className="text-xs text-muted-foreground">{selectedTechnician.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedTechnician(null)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Status</span>
                                            <p className="font-medium capitalize">{selectedTechnician.status}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Last Seen</span>
                                            <p className="font-medium">
                                                {formatDistanceToNow(new Date(selectedTechnician.lastSeen))} ago
                                            </p>
                                        </div>
                                        {selectedTechnician.speed !== undefined && selectedTechnician.speed > 0 && (
                                            <div>
                                                <span className="text-muted-foreground">Speed</span>
                                                <p className="font-medium">{selectedTechnician.speed} km/h</p>
                                            </div>
                                        )}
                                        {selectedTechnician.batteryLevel !== undefined && (
                                            <div>
                                                <span className="text-muted-foreground">Battery</span>
                                                <p className="font-medium">{selectedTechnician.batteryLevel}%</p>
                                            </div>
                                        )}
                                    </div>

                                    {selectedTechnician.address && (
                                        <div className="mt-2 pt-2 border-t">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <p className="text-sm">{selectedTechnician.address}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Empty State */}
                            {technicians.length === 0 && !isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                    <div className="text-center">
                                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                        <h3 className="font-semibold">No Technicians Online</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Technician locations will appear here when they start tracking.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
