import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import FleetMap from "@/components/dashboard/fleet-map";
import AlertPanel from "@/components/dashboard/alert-panel";
import ServiceRequestsPanel from "@/components/dashboard/service-requests-panel";
import WhatsAppHubPanel from "@/components/dashboard/whatsapp-hub-panel";
import TechnicianSchedule from "@/components/dashboard/technician-schedule";
import ContainerLookup from "@/components/dashboard/container-lookup";
import { websocket } from "@/lib/websocket";
import { getAuthToken } from "@/lib/auth";

export default function Dashboard() {
  const authToken = getAuthToken();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  const { data: containers } = useQuery({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const res = await fetch("/api/containers", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ["/api/alerts/open"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/open", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  const { data: serviceRequests } = useQuery({
    queryKey: ["/api/service-requests"],
    queryFn: async () => {
      const res = await fetch("/api/service-requests", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  const { data: technicians } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const res = await fetch("/api/technicians", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  useEffect(() => {
    websocket.on("alert_created", () => {
      refetchAlerts();
      refetchStats();
    });

    websocket.on("container_created", () => {
      refetchStats();
    });

    return () => {
      websocket.off("alert_created", () => {});
      websocket.off("container_created", () => {});
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
              <FleetMap containers={containers || []} />
            </div>
            <AlertPanel alerts={alerts || []} containers={containers || []} />
          </div>

          {/* Service Requests & WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ServiceRequestsPanel requests={serviceRequests || []} containers={containers || []} />
            <WhatsAppHubPanel />
          </div>

          {/* Technician Schedule & Container Lookup */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TechnicianSchedule technicians={technicians || []} />
            </div>
            <ContainerLookup containers={containers || []} />
          </div>
        </div>
      </main>
    </div>
  );
}
