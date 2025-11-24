import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import MapMyIndiaFleetMap from "@/components/dashboard/mapmyindia-fleet-map";
import AlertPanel from "@/components/dashboard/alert-panel";
import ServiceRequestsPanel from "@/components/dashboard/service-requests-panel";
import WhatsAppHubPanel from "@/components/dashboard/whatsapp-hub-panel";
import TechnicianSchedule from "@/components/dashboard/technician-schedule";
import ContainerLookup from "@/components/dashboard/container-lookup";
import ContainerFleetStats from "@/components/dashboard/container-fleet-stats";
import ErrorBoundary from "@/components/error-boundary";
import { websocket } from "@/lib/websocket";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const authToken = getAuthToken();
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [selectedAlertType, setSelectedAlertType] = useState<string>("temperature");

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

  const simulateAlert = useMutation({
    mutationFn: async () => {
      if (!selectedContainer) throw new Error("Please select a container");
      const response = await apiRequest("POST", "/api/alerts/simulate", {
        containerId: selectedContainer,
        alertType: selectedAlertType,
        severity: "critical"
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (err: any) => {
      console.error("Alert simulation failed:", err);
    }
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

          {/* Test Alert Simulation */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-soft">
            <h3 className="text-lg font-semibold mb-4 text-foreground">🚨 Test Alert System</h3>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1">
                <label className="text-sm font-medium">Container</label>
                <Select value={selectedContainer} onValueChange={setSelectedContainer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select container to simulate alert" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers?.slice(0, 10).map((container: any) => (
                      <SelectItem key={container.id} value={container.id}>
                        {container.containerCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Alert Type</label>
                <Select value={selectedAlertType} onValueChange={setSelectedAlertType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temperature">Temperature</SelectItem>
                    <SelectItem value="power">Power</SelectItem>
                    <SelectItem value="connectivity">Connectivity</SelectItem>
                    <SelectItem value="door">Door</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => simulateAlert.mutate()}
                disabled={simulateAlert.isPending || !selectedContainer}
                className="btn-primary px-4 py-2 rounded-md text-sm"
              >
                {simulateAlert.isPending ? "Simulating..." : "🚨 Simulate Alert"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This will create a test alert to verify the dashboard alert grouping and scrolling.
            </p>
          </div>

          {/* Map & Alerts & Fleet Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ErrorBoundary>
                <div style={{ height: '600px', width: '100%' }}>
                  <MapMyIndiaFleetMap containers={containers || []} />
                </div>
              </ErrorBoundary>
            </div>
            <div className="space-y-4">
              <ErrorBoundary>
                <div style={{ height: '400px', overflow: 'hidden' }}>
                  <AlertPanel alerts={alerts || []} containers={containers || []} />
                </div>
              </ErrorBoundary>
              <ErrorBoundary>
                <div style={{ height: '200px', overflow: 'hidden' }}>
                  <ContainerFleetStats containers={containers || []} />
                </div>
              </ErrorBoundary>
            </div>
          </div>

          {/* Service Requests & WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <ErrorBoundary>
              <div className="h-full min-w-0">
                <ServiceRequestsPanel requests={serviceRequests || []} containers={containers || []} />
              </div>
            </ErrorBoundary>
            <ErrorBoundary>
              <div className="h-full min-w-0">
                <WhatsAppHubPanel />
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
