import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AlertItem from "@/components/alert-item";
import { useEffect } from "react";
import { websocket } from "@/lib/websocket";

export default function Alerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery<any[]>({ 
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/alerts");
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

  // Live updates via WebSocket: refresh alerts/stats when new alerts are created/resolved/acknowledged
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    };

    websocket.on("alert_created", refresh);
    websocket.on("alert_resolved", refresh);
    websocket.on("alert_acknowledged", refresh);

    return () => {
      websocket.off("alert_created", refresh);
      websocket.off("alert_resolved", refresh);
      websocket.off("alert_acknowledged", refresh);
    };
  }, [queryClient]);

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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Alerts Grouped by Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {(() => {
              // Group alerts by container
              const alertsByContainer = alerts?.reduce((acc: any, alert: any) => {
                const containerId = alert.containerId;
                if (!acc[containerId]) {
                  acc[containerId] = {
                    container: containers?.find((c: any) => c.id === containerId),
                    alerts: []
                  };
                }
                acc[containerId].alerts.push(alert);
                return acc;
              }, {}) || {};

              return Object.entries(alertsByContainer).map(([containerId, { container, alerts: containerAlerts }]: [string, any]) => (
                <div key={containerId} className="bg-card border border-border rounded-lg p-4 shadow-soft">
                  {/* Container Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                    <div>
                      <h3 className="text-lg font-semibold font-mono">
                        {container?.containerCode || "Unknown Container"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {container?.type || "Unknown Type"} • {containerAlerts.length} alert{containerAlerts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status indicator for container */}
                      <div className={`w-3 h-3 rounded-full ${
                        containerAlerts.some((a: any) => a.severity === 'critical') ? 'bg-red-500' :
                        containerAlerts.some((a: any) => a.severity === 'high') ? 'bg-orange-500' :
                        containerAlerts.some((a: any) => a.severity === 'medium') ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}></div>
                    </div>
                  </div>

                  {/* Scrollable Alerts List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {containerAlerts.map((alert: any) => (
                      <AlertItem
                        key={alert.id}
                        alert={alert}
                        containerName={container?.containerCode || "Unknown"}
                        containerModel={container?.type || "Unknown"}
                        onAction={(id, action) => {
                          if (action === "acknowledge") acknowledge.mutate(id);
                          if (action === "resolve") resolve.mutate(id);
                          if (action === "dispatch") dispatch.mutate(id);
                        }}
                      />
                    ))}
                  </div>

                  {/* Container Actions */}
                  {container && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLocation(`/containers/${container.id}`)}
                          className="flex-1 px-3 py-2 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth"
                        >
                          View Container
                        </button>
                        <button
                          onClick={() => {
                            // Bulk acknowledge all alerts for this container
                            containerAlerts.forEach((alert: any) => {
                              acknowledge.mutate(alert.id);
                            });
                          }}
                          className="px-3 py-2 text-xs font-medium border border-blue-500/30 text-blue-400 rounded hover:bg-blue-500/10 transition-smooth"
                          disabled={acknowledge.isPending}
                        >
                          {acknowledge.isPending ? "Processing..." : "Ack All"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
