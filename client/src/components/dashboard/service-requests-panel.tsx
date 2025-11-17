interface ServiceRequest {
  id: string;
  requestNumber: string;
  containerId: string;
  status: string;
  priority: string;
  issueDescription: string;
}

interface ServiceRequestsPanelProps {
  requests: ServiceRequest[];
  containers: any[];
}

export default function ServiceRequestsPanel({ requests, containers }: ServiceRequestsPanelProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-warning/20 text-warning",
      approved: "bg-primary/20 text-primary",
      scheduled: "bg-primary/20 text-primary",
      in_progress: "bg-success/20 text-success",
      completed: "bg-success/20 text-success",
      cancelled: "bg-destructive/20 text-destructive",
    };
    return colors[status as keyof typeof colors] || "bg-muted/20 text-muted-foreground";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: "bg-destructive/20 text-destructive",
      high: "bg-warning/20 text-warning",
      medium: "bg-accent/20 text-accent",
      low: "bg-muted/20 text-muted-foreground",
    };
    return colors[priority as keyof typeof colors] || "bg-muted/20 text-muted-foreground";
  };

  return (
    <div className="bg-card border border-service/20 rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-service/10 rounded-lg">
            <i className="fas fa-wrench text-service text-sm"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Recent Service Requests</h3>
        </div>
        <button className="btn-primary px-4 py-2 rounded-md text-xs font-medium">
          + New Request
        </button>
      </div>

      <div className="overflow-x-auto min-w-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">ID</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Container</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Issue</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Priority</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 5).map((request) => {
              const container = containers.find((c) => c.id === request.containerId);
              return (
                <tr key={request.id} className="border-b" style={{ borderColor: '#FFE0D6' }}>
                  <td className="py-3 px-2 font-mono text-xs">{request.requestNumber}</td>
                  <td className="py-3 px-2 font-mono text-xs">{container?.containerCode || container?.containerId || "Unknown"}</td>
                  <td className="py-3 px-2">{(request.issueDescription || "").substring(0, 28)}{(request.issueDescription || "").length > 28 ? "..." : ""}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 ${getPriorityColor(request.priority)} text-xs rounded-full`}>
                      {request.priority}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 ${getStatusColor(request.status)} text-xs rounded-full`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button className="btn-secondary px-3 py-1.5 rounded-md text-xs">View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
