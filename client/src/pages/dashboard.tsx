import { useQuery } from "@tanstack/react-query";
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

export default function Dashboard() {
  const authToken = getAuthToken();

  const { data: stats, refetch: refetchStats } = useQuery({ queryKey: ["/api/dashboard/stats"] });

  const { data: containers } = useQuery({ queryKey: ["/api/containers"] });

  const { data: alerts, refetch: refetchAlerts } = useQuery({ queryKey: ["/api/alerts/open"] });

  const { data: serviceRequests } = useQuery({ queryKey: ["/api/service-requests"] });

  const { data: technicians } = useQuery({ queryKey: ["/api/technicians"] });

  useEffect(() => {
    // Live updates for device→container location
    const onDeviceUpdate = (payload: any) => {
      // Optimistically update containers cache
      try {
        const { queryClient } = require("@/lib/queryClient");
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

    websocket.on("alert_created", () => {
      refetchAlerts();
      refetchStats();
    });

    websocket.on("container_created", () => {
      refetchStats();
    });

    websocket.on("device_update", onDeviceUpdate);

    return () => {
      websocket.off("alert_created", () => {});
      websocket.off("container_created", () => {});
      websocket.off("device_update", onDeviceUpdate);
    };
  }, [refetchAlerts, refetchStats]);

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
