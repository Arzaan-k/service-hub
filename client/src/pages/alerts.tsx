import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AlertItem from "@/components/alert-item";

export default function Alerts() {
  const queryClient = useQueryClient();

  const { data: alerts } = useQuery({ queryKey: ["/api/alerts"] });

  const { data: containers } = useQuery({ queryKey: ["/api/containers"] });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/alerts/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/alerts/${id}/resolve`, { resolutionMethod: "service" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  });

  const dispatch = useMutation({
    mutationFn: async (alertId: string) => {
      // Create a service request from alert
      await apiRequest("POST", "/api/service-requests", { alertId, issueDescription: "Auto-dispatch from alert" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
    }
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Alerts & Monitoring" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {alerts?.map((alert: any) => {
              const container = containers?.find((c: any) => c.id === alert.containerId);
              return (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  containerName={container?.containerCode || "Unknown"}
                  onAction={(id, action) => {
                    if (action === "acknowledge") acknowledge.mutate(id);
                    if (action === "resolve") resolve.mutate(id);
                    if (action === "dispatch") dispatch.mutate(id);
                  }}
                />
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
