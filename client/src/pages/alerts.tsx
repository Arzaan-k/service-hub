import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AlertItem from "@/components/alert-item";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { websocket } from "@/lib/websocket";

export default function Alerts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [selectedAlertType, setSelectedAlertType] = useState<string>("temperature");

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      
      if (result.remoteResolved) {
        toast({ title: "Alert Resolved Remotely", description: "Issue was fixed without technician visit" });
      } else if (result.serviceRequest) {
        toast({ title: "Service Request Created", description: `Auto-assigned and technician notified` });
      } else {
        toast({ title: "Alert Created", description: "Alert logged for monitoring" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Simulation Failed", description: err?.message || "Could not simulate alert", variant: "destructive" });
    }
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Alerts & Monitoring" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Test Automation Section */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">🤖 Test Automation Workflow</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Container</label>
                <Select value={selectedContainer} onValueChange={setSelectedContainer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select container to simulate alert" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers?.map((container: any) => (
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
                className="bg-orange-600 hover:bg-orange-700"
              >
                {simulateAlert.isPending ? "Simulating..." : "🚨 Simulate Alert"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This will trigger: Alert → Remote Resolution Attempt → Service Request Creation → Technician Assignment → WhatsApp Notifications
            </p>
          </div>

          {/* Alerts List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {alerts?.map((alert: any) => {
              const container = containers?.find((c: any) => c.id === alert.containerId);
              return (
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
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
