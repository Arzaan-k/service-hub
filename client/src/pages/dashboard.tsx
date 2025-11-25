import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import FleetMap from "@/components/dashboard/fleet-map";
import AlertPanel from "@/components/dashboard/alert-panel";
import ServiceRequestsPanel from "@/components/dashboard/service-requests-panel";
import ContainerFleetStats from "@/components/dashboard/container-fleet-stats";
import TechnicianSchedule from "@/components/dashboard/technician-schedule";
import ContainerLookup from "@/components/dashboard/container-lookup";
import ErrorBoundary from "@/components/error-boundary";
import { websocket } from "@/lib/websocket";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const authToken = getAuthToken();

  const { data: stats = {} } = useQuery<any>({ 
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/dashboard/stats");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: containers = [] } = useQuery<any[]>({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/alerts");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: serviceRequests = [] } = useQuery<any[]>({ 
    queryKey: ["/api/service-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/service-requests");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/technicians");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });


  // Initialize data on component mount
  useEffect(() => {
    // Removed test auth initialization - was causing conflicts with real authentication
  }, []);

  useEffect(() => {
    // Live updates for device→container location
    const onDeviceUpdate = (payload: any) => {
      // Optimistically update containers cache
      try {
        queryClient.setQueryData(["/api/containers"], (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          const { deviceId, lat, lng } = payload || {};
          if (!deviceId || lat == null || lng == null) return prev;
          return prev.map((c: any) =>
            c.orbcommDeviceId === deviceId
              ? { ...c, currentLocation: { ...(c.currentLocation || {}), lat, lng } }
              : c
          );
        });
      } catch {}
    };

    // Live updates when server identifies the container directly
    const onContainerLocUpdate = (payload: any) => {
      try {
        queryClient.setQueryData(["/api/containers"], (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          const { containerId, lat, lng } = payload || {};
          if (!containerId || lat == null || lng == null) return prev;
          return prev.map((c: any) =>
            c.id === containerId
              ? { ...c, currentLocation: { ...(c.currentLocation || {}), lat, lng } }
              : c
          );
        });
      } catch {}
    };

    websocket.on("alert_created", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    });

    websocket.on("container_created", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    });

    // Handle Orbcomm real-time container updates
    const onContainerUpdate = (payload: any) => {
      try {
        queryClient.setQueryData(["/api/containers"], (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          const { containerId, latitude, longitude, temperature, powerStatus } = payload || {};
          if (!containerId) return prev;

          return prev.map((c: any) =>
            c.id === containerId
              ? {
                  ...c,
                  locationLat: latitude?.toString(),
                  locationLng: longitude?.toString(),
                  temperature,
                  powerStatus,
                  lastUpdateTimestamp: payload.timestamp,
                  currentLocation: latitude && longitude ? {
                    ...(c.currentLocation || {}),
                    lat: parseFloat(latitude),
                    lng: parseFloat(longitude),
                  } : c.currentLocation
                }
              : c
          );
        });
      } catch (error) {
        console.error('Error handling container update:', error);
      }
    };

    websocket.on("device_update", onDeviceUpdate);
    websocket.on("container_location_update", onContainerLocUpdate);
    websocket.on("container_update", onContainerUpdate);

    return () => {
      websocket.off("alert_created");
      websocket.off("container_created");
      websocket.off("device_update", onDeviceUpdate);
      websocket.off("container_location_update", onContainerLocUpdate);
      websocket.off("container_update", onContainerUpdate);
    };
  }, [queryClient]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Fleet Dashboard" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Cards */}
          <div className="min-w-0">
            <KPICards stats={stats} />
          </div>


          {/* Map & Alerts & Fleet Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: '600px', minHeight: '600px', maxHeight: '600px', overflow: 'visible' }}>
            <div className="lg:col-span-2" style={{ height: '600px' }}>
              <ErrorBoundary>
                  <FleetMap containers={containers || []} />
              </ErrorBoundary>
            </div>
            <div style={{ height: '600px' }}>
              <ErrorBoundary>
                <div style={{ height: '100%' }}>
                  <AlertPanel alerts={alerts || []} containers={containers || []} />
                </div>
              </ErrorBoundary>
            </div>
          </div>

          {/* Service Requests & Fleet Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <ErrorBoundary>
              <div className="h-full min-w-0">
                <ServiceRequestsPanel requests={serviceRequests || []} containers={containers || []} />
              </div>
            </ErrorBoundary>
            <ErrorBoundary>
              <div className="h-full min-w-0">
                <ContainerFleetStats containers={containers || []} />
              </div>
            </ErrorBoundary>
          </div>

          {/* Technician Schedule & Container Lookup */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-2">
              <ErrorBoundary>
                <TechnicianSchedule technicians={technicians || []} />
              </ErrorBoundary>
            </div>
            <ErrorBoundary>
              <ContainerLookup containers={containers || []} />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
