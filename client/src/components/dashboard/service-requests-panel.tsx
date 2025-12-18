import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GlassCard } from "@/components/ui/animated-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceRequest {
  id: string;
  requestNumber: string;
  containerId: string;
  status: string;
  priority: string;
  issueDescription: string;
  isDuplicate?: boolean;
  duplicateCount?: number;
  container?: {
    containerCode: string;
  };
}

interface ServiceRequestsPanelProps {
  requests: ServiceRequest[];
  containers: any[];
  alerts: any[];
}

export default function ServiceRequestsPanel({ requests, containers, alerts }: ServiceRequestsPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string>("");
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>("medium");
  const [issueDescription, setIssueDescription] = useState<string>("");

  // Filter alerts for the selected container
  const containerAlerts = alerts.filter(
    (a) => a.containerId === selectedContainerId && !a.resolvedAt
  );

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/service-requests", data);
      return res.json();
    },
    onSuccess: async (newRequest) => {
      // If alerts were selected, acknowledge them and link them (conceptually)
      if (selectedAlertIds.length > 0) {
        // We can acknowledge them in parallel
        await Promise.all(selectedAlertIds.map(id =>
          apiRequest("PUT", `/api/alerts/${id}/acknowledge`)
        ));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });

      toast({
        title: "Service Request Created",
        description: `Request ${newRequest.requestNumber} has been created successfully.`,
      });

      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service request",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setSelectedContainerId("");
    setSelectedAlertIds([]);
    setPriority("medium");
    setIssueDescription("");
  };

  const handleCreateRequest = () => {
    if (!selectedContainerId) {
      toast({ title: "Validation Error", description: "Please select a container", variant: "destructive" });
      return;
    }
    if (!issueDescription && selectedAlertIds.length === 0) {
      toast({ title: "Validation Error", description: "Please provide a description or select alerts", variant: "destructive" });
      return;
    }

    // Append selected alerts to description if any
    let finalDescription = issueDescription;
    if (selectedAlertIds.length > 0) {
      const selectedAlertsInfo = containerAlerts
        .filter(a => selectedAlertIds.includes(a.id))
        .map(a => `${a.alertCode}: ${a.title}`)
        .join(", ");

      finalDescription = finalDescription
        ? `${finalDescription}\n\nRelated Alerts: ${selectedAlertsInfo}`
        : `Service requested for alerts: ${selectedAlertsInfo}`;
    }

    createRequestMutation.mutate({
      containerId: selectedContainerId,
      priority,
      issueDescription: finalDescription,
      customerId: containers.find(c => c.id === selectedContainerId)?.currentCustomerId // Assuming we have this or backend handles it
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-amber-500/20 text-amber-500",
      approved: "bg-blue-500/20 text-blue-500",
      scheduled: "bg-blue-500/20 text-blue-500",
      in_progress: "bg-purple-500/20 text-purple-500",
      completed: "bg-green-500/20 text-green-500",
      cancelled: "bg-red-500/20 text-red-500",
    };
    return colors[status as keyof typeof colors] || "bg-gray-500/20 text-gray-500";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: "bg-red-500/20 text-red-500",
      high: "bg-orange-500/20 text-orange-500",
      medium: "bg-blue-500/20 text-blue-500",
      low: "bg-gray-500/20 text-gray-500",
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500/20 text-gray-500";
  };

  return (
    <GlassCard className="h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <i className="fas fa-wrench text-orange-500 text-lg"></i>
          </div>
          <h3 className="text-xl font-bold text-foreground tracking-tight">Recent Service Requests</h3>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40">
              + New Request
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create Service Request</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Container</Label>
                <Select value={selectedContainerId} onValueChange={setSelectedContainerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select container..." />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.containerCode} ({c.type || 'Unknown'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedContainerId && containerAlerts.length > 0 && (
                <div className="space-y-2 border rounded-md p-3 bg-muted/10">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Active Alerts (Select to include)</Label>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {containerAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={alert.id}
                          checked={selectedAlertIds.includes(alert.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAlertIds([...selectedAlertIds, alert.id]);
                            } else {
                              setSelectedAlertIds(selectedAlertIds.filter(id => id !== alert.id));
                            }
                          }}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={alert.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${alert.severity === 'critical' ? 'bg-red-500/20 text-red-500' :
                                alert.severity === 'high' ? 'bg-orange-500/20 text-orange-500' :
                                  'bg-blue-500/20 text-blue-500'
                              }`}>
                              {alert.severity}
                            </span>
                            {alert.title}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {alert.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Issue Description</Label>
                <Textarea
                  placeholder="Describe the issue..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateRequest} disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile View: Cards */}
      <div className="lg:hidden space-y-3">
        {requests.slice(0, 5).map((request) => {
          const container = containers.find((c) => c.id === request.containerId);
          return (
            <div key={request.id} className={`rounded-xl p-4 space-y-3 ${
              request.isDuplicate 
                ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500' 
                : 'bg-white/5 border border-white/10'
            }`}>
              {/* Duplicate Warning */}
              {request.isDuplicate && (
                <div className="flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Duplicate ({request.duplicateCount}x)
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-primary">{request.requestNumber}</span>
                    <span className={`px-2 py-0.5 ${getStatusColor(request.status)} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                      {request.status}
                    </span>
                  </div>
                  <div className={`font-mono text-xs font-medium ${
                    request.isDuplicate ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-foreground/80'
                  }`}>
                    {container?.containerCode || container?.containerId || "Unknown"}
                  </div>
                </div>
                <span className={`px-2 py-0.5 ${getPriorityColor(request.priority)} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                  {request.priority}
                </span>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 bg-black/20 p-2 rounded-lg">
                {request.issueDescription || "No description provided."}
              </p>

              <button className="w-full text-center text-xs font-medium border border-white/10 hover:border-primary/30 hover:bg-primary/10 py-2 rounded-lg transition-colors">
                View Details
              </button>
            </div>
          );
        })}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden lg:block overflow-x-auto min-w-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-4 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">ID</th>
              <th className="text-left py-4 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Container</th>
              <th className="text-left py-4 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Issue</th>
              <th className="text-left py-4 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Priority</th>
              <th className="text-left py-4 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Status</th>
              <th className="text-left py-4 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 5).map((request) => {
              const container = containers.find((c) => c.id === request.containerId);
              return (
                <tr key={request.id} className={`border-b border-white/5 transition-colors group ${
                  request.isDuplicate 
                    ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30' 
                    : 'hover:bg-white/5'
                }`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-primary">{request.requestNumber}</span>
                      {request.isDuplicate && (
                        <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {request.duplicateCount}x
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className={`py-3 px-4 font-mono text-xs ${
                    request.isDuplicate ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-foreground/80'
                  }`}>{container?.containerCode || container?.containerId || "Unknown"}</td>
                  <td className="py-3 px-4 text-foreground/80">{(request.issueDescription || "").substring(0, 28)}{(request.issueDescription || "").length > 28 ? "..." : ""}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 ${getPriorityColor(request.priority)} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                      {request.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 ${getStatusColor(request.status)} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-muted-foreground hover:text-primary transition-colors text-xs font-medium border border-white/10 hover:border-primary/30 hover:bg-primary/10 px-3 py-1.5 rounded-lg">View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
