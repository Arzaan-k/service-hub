import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ServiceRequest {
  id: string;
  requestNumber: string;
  containerId: string;
  clientId: string;
  assignedTechnicianId?: string;
  status: string;
  priority: string;
  issueDescription: string;
  requiredParts?: string[];
  scheduledDate?: string;
  createdAt: string;
}

interface Container {
  id: string;
  containerId: string;
  currentLocation?: {
    address?: string;
  };
}

interface ServiceRequestsProps {
  requests: ServiceRequest[];
  containers: Container[];
  onRefresh?: () => void;
}

export default function ServiceRequests({ requests, containers, onRefresh }: ServiceRequestsProps) {
  const { toast } = useToast();
  const authToken = getAuthToken();

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-warning/20 text-warning border-warning/20",
      approved: "bg-primary/20 text-primary border-primary/20",
      scheduled: "bg-primary/20 text-primary border-primary/20",
      in_progress: "bg-success/20 text-success border-success/20",
      completed: "bg-success/20 text-success border-success/20",
      cancelled: "bg-destructive/20 text-destructive border-destructive/20",
    };
    return colors[status as keyof typeof colors] || "bg-muted/20 text-muted-foreground border-muted/20";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: "bg-destructive text-destructive-foreground",
      high: "bg-warning text-warning-foreground",
      medium: "bg-accent text-accent-foreground",
      low: "bg-muted text-muted-foreground",
    };
    return colors[priority as keyof typeof colors] || "bg-muted text-muted-foreground";
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/service-requests/${id}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service request updated successfully",
      });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (id: string, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Service Request Management</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage all service requests across the fleet
          </p>
        </div>
        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-smooth"
          data-testid="button-new-request"
        >
          <i className="fas fa-plus mr-2"></i>New Request
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button className="px-3 py-1.5 bg-warning/10 text-warning rounded-lg text-xs font-medium whitespace-nowrap">
          Pending ({requests.filter((r) => r.status === "pending").length})
        </button>
        <button className="px-3 py-1.5 bg-card border border-border text-foreground rounded-lg text-xs font-medium whitespace-nowrap">
          Scheduled ({requests.filter((r) => r.status === "scheduled").length})
        </button>
        <button className="px-3 py-1.5 bg-card border border-border text-foreground rounded-lg text-xs font-medium whitespace-nowrap">
          In Progress ({requests.filter((r) => r.status === "in_progress").length})
        </button>
        <button className="px-3 py-1.5 bg-card border border-border text-foreground rounded-lg text-xs font-medium whitespace-nowrap">
          Completed ({requests.filter((r) => r.status === "completed").length})
        </button>
        <button className="px-3 py-1.5 bg-card border border-border text-foreground rounded-lg text-xs font-medium whitespace-nowrap">
          All ({requests.length})
        </button>
      </div>

      {/* Service Requests Grid */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
        {requests.map((request) => {
          const container = containers.find((c) => c.id === request.containerId);
          const statusColors = getStatusColor(request.status);
          const priorityColors = getPriorityColor(request.priority);

          return (
            <div
              key={request.id}
              className={`border ${statusColors.split(" ")[0].replace("bg-", "border-")} rounded-xl p-4 hover:shadow-lg transition-smooth`}
              data-testid={`service-request-${request.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${statusColors.split(" ")[0]} flex items-center justify-center`}>
                    <i className={`fas fa-wrench ${statusColors.split(" ")[1]}`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-foreground">{request.requestNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {container?.containerId || "Unknown Container"} • {container?.currentLocation?.address || "Location TBD"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 ${priorityColors} text-xs rounded-full font-medium uppercase`}>
                    {request.priority}
                  </span>
                  <span className={`px-2 py-0.5 ${statusColors} text-xs rounded-full font-medium`}>
                    {request.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Issue Description */}
              <div className="mb-3">
                <p className="text-sm text-foreground">{request.issueDescription}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <i className="fas fa-calendar text-muted-foreground"></i>
                  <div>
                    <span className="text-muted-foreground">Created: </span>
                    <span className="text-foreground">{new Date(request.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {request.scheduledDate && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-clock text-muted-foreground"></i>
                    <div>
                      <span className="text-muted-foreground">Scheduled: </span>
                      <span className="text-foreground">{new Date(request.scheduledDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
                {request.assignedTechnicianId && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-user-hard-hat text-muted-foreground"></i>
                    <div>
                      <span className="text-muted-foreground">Technician: </span>
                      <span className="text-foreground">Assigned</span>
                    </div>
                  </div>
                )}
                {request.requiredParts && request.requiredParts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-tools text-muted-foreground"></i>
                    <div>
                      <span className="text-muted-foreground">Parts: </span>
                      <span className="text-foreground">{request.requiredParts.length} items</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Required Parts List */}
              {request.requiredParts && request.requiredParts.length > 0 && (
                <div className="mb-3 p-2 bg-muted/20 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Required Parts:</p>
                  <div className="flex flex-wrap gap-1">
                    {request.requiredParts.map((part, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                        {part}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {request.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(request.id, "scheduled")}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 min-w-[120px] px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-smooth disabled:opacity-50"
                      data-testid={`button-schedule-${request.id}`}
                    >
                      <i className="fas fa-calendar-plus mr-1"></i>Schedule
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(request.id, "cancelled")}
                      disabled={updateStatusMutation.isPending}
                      className="px-3 py-1.5 bg-destructive/10 text-destructive rounded text-xs font-medium hover:bg-destructive/20 transition-smooth disabled:opacity-50"
                      data-testid={`button-cancel-${request.id}`}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {request.status === "scheduled" && (
                  <button
                    onClick={() => handleStatusUpdate(request.id, "in_progress")}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 px-3 py-1.5 bg-success text-success-foreground rounded text-xs font-medium hover:opacity-90 transition-smooth disabled:opacity-50"
                    data-testid={`button-start-${request.id}`}
                  >
                    <i className="fas fa-play mr-1"></i>Start Service
                  </button>
                )}
                {request.status === "in_progress" && (
                  <button
                    onClick={() => handleStatusUpdate(request.id, "completed")}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 px-3 py-1.5 bg-success text-success-foreground rounded text-xs font-medium hover:opacity-90 transition-smooth disabled:opacity-50"
                    data-testid={`button-complete-${request.id}`}
                  >
                    <i className="fas fa-check mr-1"></i>Mark Complete
                  </button>
                )}
                <button
                  className="px-3 py-1.5 bg-card border border-border text-foreground rounded text-xs font-medium hover:bg-muted/20 transition-smooth"
                  data-testid={`button-details-${request.id}`}
                >
                  <i className="fas fa-info-circle mr-1"></i>Details
                </button>
                <button
                  className="px-3 py-1.5 bg-card border border-border text-foreground rounded text-xs font-medium hover:bg-muted/20 transition-smooth"
                  data-testid={`button-whatsapp-${request.id}`}
                >
                  <i className="fab fa-whatsapp mr-1"></i>Notify
                </button>
              </div>

              {/* Progress Indicator */}
              {request.status === "in_progress" && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">Service in progress</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <div className="bg-success h-1.5 rounded-full" style={{ width: "65%" }}></div>
                    </div>
                    <span className="text-xs text-success font-medium">65%</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {requests.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-inbox text-muted-foreground text-2xl"></i>
            </div>
            <p className="text-sm text-muted-foreground">No service requests found</p>
            <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-smooth">
              <i className="fas fa-plus mr-2"></i>Create First Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
