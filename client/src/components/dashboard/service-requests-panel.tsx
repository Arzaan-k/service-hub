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

import { GlassCard } from "@/components/ui/animated-card";

export default function ServiceRequestsPanel({ requests, containers }: ServiceRequestsPanelProps) {
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
        <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40">
          + New Request
        </button>
      </div>

      <div className="overflow-x-auto min-w-0">
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
                <tr key={request.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-4 font-mono text-xs font-medium text-primary">{request.requestNumber}</td>
                  <td className="py-4 px-4 font-mono text-xs text-foreground/80">{container?.containerCode || container?.containerId || "Unknown"}</td>
                  <td className="py-4 px-4 text-foreground/80">{(request.issueDescription || "").substring(0, 28)}{(request.issueDescription || "").length > 28 ? "..." : ""}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 ${getPriorityColor(request.priority)} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                      {request.priority}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 ${getStatusColor(request.status)} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
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
