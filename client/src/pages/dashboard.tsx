import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import GlobalFleetMap from "@/components/dashboard/global-fleet-map";
import AlertPanel from "@/components/dashboard/alert-panel";
import ServiceRequestsPanel from "@/components/dashboard/service-requests-panel";
import WhatsAppHubPanel from "@/components/dashboard/whatsapp-hub-panel";
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
      return response.json();
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

    websocket.on("device_update", onDeviceUpdate);
    websocket.on("container_location_update", onContainerLocUpdate);

    return () => {
      websocket.off("alert_created");
      websocket.off("container_created");
      websocket.off("device_update", onDeviceUpdate);
      websocket.off("container_location_update", onContainerLocUpdate);
    };
  }, [queryClient]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Fleet Dashboard" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Cards */}
          <KPICards stats={stats} />

          {/* Map & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ErrorBoundary>
                <GlobalFleetMap containers={containers || []} />
              </ErrorBoundary>
            </div>
            <ErrorBoundary>
              <AlertPanel alerts={alerts || []} containers={containers || []} />
            </ErrorBoundary>
          </div>

          {/* Service Requests & WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorBoundary>
              <ServiceRequestsPanel requests={serviceRequests || []} containers={containers || []} />
            </ErrorBoundary>
            <ErrorBoundary>
              <WhatsAppHubPanel />
            </ErrorBoundary>
          </div>

          {/* Technician Schedule & Container Lookup */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
