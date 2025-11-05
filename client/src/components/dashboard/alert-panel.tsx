interface Alert {
  id: string;
  severity: string;
  title: string;
  description: string;
  detectedAt: string;
  containerId: string;
  aiClassification?: any;
}

interface AlertPanelProps {
  alerts: Alert[];
  containers: any[];
}

export default function AlertPanel({ alerts, containers }: AlertPanelProps) {
  const getSeverityColors = (severity: string) => {
    const colors = {
      critical: { bg: "bg-destructive/5", border: "border-destructive/20", text: "text-destructive", badge: "bg-destructive" },
      high: { bg: "bg-warning/5", border: "border-warning/20", text: "text-warning", badge: "bg-warning" },
      medium: { bg: "bg-accent/5", border: "border-accent/20", text: "text-accent", badge: "bg-accent" },
      low: { bg: "bg-muted/5", border: "border-muted/20", text: "text-muted-foreground", badge: "bg-muted" },
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="bg-card border border-alerts/20 rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-alerts/10 rounded-lg">
            <i className="fas fa-exclamation-triangle text-alerts text-sm"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Active Alerts</h3>
        </div>
        <button className="text-xs text-alerts hover:underline">View All</button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-thin">
        {alerts.slice(0, 5).map((alert) => {
          const container = containers.find((c) => c.id === alert.containerId);
          const colors = getSeverityColors(alert.severity);

          return (
            <div key={alert.id} className={`p-3 ${colors.bg} border ${colors.border} rounded-lg`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 ${colors.badge} text-white text-xs font-medium rounded uppercase`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.detectedAt).toLocaleString()}
                  </span>
                </div>
                <div className={`w-2 h-2 ${colors.badge} rounded-full pulse-indicator`}></div>
              </div>
              <p className={`text-sm font-medium ${colors.text} mb-1`}>{alert.title}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {container?.containerCode || container?.containerId || "Unknown"}
              </p>
              <p className="text-xs text-foreground mb-3">{alert.description}</p>
              {alert.aiClassification && (
                <p className="text-xs text-foreground mb-3">
                  AI Analysis: {alert.aiClassification.rootCause}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  className={`flex-1 px-3 py-1.5 text-xs font-medium ${colors.badge} text-white rounded hover:opacity-90 transition-smooth`}
                >
                  Dispatch Technician
                </button>
                <button className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth">
                  Details
                </button>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No active alerts</p>
        )}
      </div>
    </div>
  );
}
