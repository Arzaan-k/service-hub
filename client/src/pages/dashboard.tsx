import { useLocation, Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import FleetMap from "@/components/dashboard/fleet-map";
import AlertPanel from "@/components/dashboard/alert-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServiceRequestsPanel from "@/components/dashboard/service-requests-panel";
import ContainerFleetStats from "@/components/dashboard/container-fleet-stats";
import TechnicianSchedule from "@/components/dashboard/technician-schedule";
import ContainerLookup from "@/components/dashboard/container-lookup";
import ErrorBoundary from "@/components/error-boundary";
import { websocket } from "@/lib/websocket";
import { getAuthToken, useAuth, getCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const authToken = getAuthToken();
  const { user } = useAuth();

  // CRITICAL SECURITY: Role-based access control for Dashboard
  // Only admin, coordinator, and super_admin should see this full dashboard
  const userRole = (user?.role || getCurrentUser()?.role || "client").toLowerCase();
  console.log(`[DASHBOARD] User role check: ${userRole}`);

  if (userRole === "technician") {
    console.log(`[DASHBOARD] Technician detected, redirecting to /my-profile`);
    return <Redirect to="/my-profile" />;
  }

  if (userRole === "client") {
    console.log(`[DASHBOARD] Client detected, redirecting to /client-dashboard`);
    return <Redirect to="/client-dashboard" />;
  }

  // Only allow admin, coordinator, super_admin, and senior_technician to view this dashboard
  if (!["admin", "coordinator", "super_admin", "senior_technician"].includes(userRole)) {
    console.log(`[DASHBOARD] Unauthorized role: ${userRole}, redirecting to login`);
    return <Redirect to="/login" />;
  }


  const { data: stats = {} } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/dashboard/stats");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Determine API endpoints based on user role
  const isClient = user?.role === 'client';
  const containersEndpoint = isClient ? "/api/customers/me/containers" : "/api/containers";

  // For dashboard, load first 100 containers with pagination to reduce memory
  const { data: containers = [] } = useQuery<any[]>({
    queryKey: [containersEndpoint, "dashboard"],
    queryFn: async () => {
      // For non-clients, use pagination to limit initial load
      const url = isClient ? containersEndpoint : `${containersEndpoint}?limit=100&offset=0`;
      const response = await apiRequest("GET", url);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts", "dashboard"],
    queryFn: async () => {
      // Limit to 100 most recent alerts for dashboard to reduce memory
      const response = await apiRequest("GET", "/api/alerts?limit=100&offset=0");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: serviceRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/service-requests", "dashboard"],
    queryFn: async () => {
      // Limit to 100 most recent service requests for dashboard to reduce memory
      const response = await apiRequest("GET", "/api/service-requests?limit=100&offset=0");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      // Technicians are typically fewer, fetch all
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
      } catch { }
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
      } catch { }
    };

    const onAlertCreated = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    };

    const onContainerCreated = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    };

    // Refresh technician schedules and assigned services when assignments happen
    websocket.on("service_request_assigned", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
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

    const onServiceRequestAssigned = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
    };

    const onServiceRequestStarted = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
    };

    const onServiceRequestCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    };

    websocket.on("alert_created", onAlertCreated);
    websocket.on("container_created", onContainerCreated);
    websocket.on("service_request_assigned", onServiceRequestAssigned);
    websocket.on("service_request_started", onServiceRequestStarted);
    websocket.on("service_request_completed", onServiceRequestCompleted);
    websocket.on("device_update", onDeviceUpdate);
    websocket.on("container_location_update", onContainerLocUpdate);
    websocket.on("container_update", onContainerUpdate);

    return () => {
      websocket.off("alert_created", onAlertCreated);
      websocket.off("container_created", onContainerCreated);
      websocket.off("service_request_assigned", onServiceRequestAssigned);
      websocket.off("service_request_started", onServiceRequestStarted);
      websocket.off("service_request_completed", onServiceRequestCompleted);
      websocket.off("device_update", onDeviceUpdate);
      websocket.off("container_location_update", onContainerLocUpdate);
      websocket.off("container_update", onContainerUpdate);
    };
  }, [queryClient]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen">
        <Header title="Fleet Dashboard" />
        <div className="flex-1 p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards - Now Horizontal Slider on Mobile */}
          <div className="min-w-0">
            <KPICards stats={stats} />
          </div>

          {/* Mobile View: Tabbed Interface */}
          <div className="lg:hidden">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4 bg-white/5 border border-white/10">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
                <TabsTrigger value="service" className="text-xs">Service</TabsTrigger>
                <TabsTrigger value="manage" className="text-xs">Manage</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="h-[350px] rounded-xl overflow-hidden border border-white/10 shadow-lg">
                  <ErrorBoundary>
                    <FleetMap containers={containers || []} />
                  </ErrorBoundary>
                </div>
                <ErrorBoundary>
                  <ContainerFleetStats containers={containers || []} />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="alerts">
                <div className="h-[500px]">
                  <ErrorBoundary>
                    <AlertPanel alerts={alerts || []} containers={containers || []} />
                  </ErrorBoundary>
                </div>
              </TabsContent>

              <TabsContent value="service" className="space-y-4">
                <ErrorBoundary>
                  <ServiceRequestsPanel requests={serviceRequests || []} containers={containers || []} alerts={alerts || []} />
                </ErrorBoundary>
                <ErrorBoundary>
                  <TechnicianSchedule technicians={technicians || []} />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="manage">
                <ErrorBoundary>
                  <ContainerLookup containers={containers || []} />
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </div>

          {/* Desktop View: Grid Layout */}
          <div className="hidden lg:block space-y-6">
            {/* Map & Alerts & Fleet Stats */}
            <div className="grid grid-cols-3 gap-6 h-[600px]">
              <div className="col-span-2 h-full min-h-0">
                <ErrorBoundary>
                  <div className="h-full">
                    <FleetMap containers={containers || []} />
                  </div>
                </ErrorBoundary>
              </div>
              <div className="h-full min-h-0">
                <ErrorBoundary>
                  <div className="h-full">
                    <AlertPanel alerts={alerts || []} containers={containers || []} />
                  </div>
                </ErrorBoundary>
              </div>
            </div>

            {/* Service Requests & Fleet Overview */}
            <div className="grid grid-cols-2 gap-6 items-stretch">
              <ErrorBoundary>
                <div className="h-full min-w-0">
                  <ServiceRequestsPanel requests={serviceRequests || []} containers={containers || []} alerts={alerts || []} />
                </div>
              </ErrorBoundary>
              <ErrorBoundary>
                <div className="h-full min-w-0">
                  <ContainerFleetStats containers={containers || []} />
                </div>
              </ErrorBoundary>
            </div>

            {/* Technician Schedule & Container Lookup */}
            <div className="grid grid-cols-3 gap-6 items-stretch">
              <div className="col-span-2">
                <ErrorBoundary>
                  <TechnicianSchedule technicians={technicians || []} />
                </ErrorBoundary>
              </div>
              <ErrorBoundary>
                <ContainerLookup containers={containers || []} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
