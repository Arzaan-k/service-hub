interface AlertItemProps {
  alert: {
    id: string;
    severity: string;
    title: string;
    description: string;
    detectedAt: string;
    containerId: string;
  };
  containerName: string;
  onAction?: (alertId: string, action: string) => void;
}

export default function AlertItem({ alert, containerName, onAction }: AlertItemProps) {
  const severityColors = {
    critical: { bg: "bg-destructive/5", border: "border-destructive/20", text: "text-destructive", badge: "bg-destructive" },
    high: { bg: "bg-warning/5", border: "border-warning/20", text: "text-warning", badge: "bg-warning" },
    medium: { bg: "bg-accent/5", border: "border-accent/20", text: "text-accent", badge: "bg-accent" },
    low: { bg: "bg-muted/5", border: "border-muted/20", text: "text-muted-foreground", badge: "bg-muted" },
  };

  const colors = severityColors[alert.severity as keyof typeof severityColors] || severityColors.medium;

  return (
    <div className={`p-3 ${colors.bg} border ${colors.border} rounded-lg`} data-testid={`alert-item-${alert.id}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 ${colors.badge} text-${colors.badge === "bg-muted" ? "muted-foreground" : "white"} text-xs font-medium rounded uppercase`}>
            {alert.severity}
          </span>
          <span className="text-xs text-muted-foreground">{new Date(alert.detectedAt).toLocaleString()}</span>
        </div>
        <div className={`w-2 h-2 ${colors.badge} rounded-full pulse-indicator`}></div>
      </div>
      <p className={`text-sm font-medium ${colors.text} mb-1`}>{alert.title}</p>
      <p className="text-xs text-muted-foreground mb-2">{containerName}</p>
      <p className="text-xs text-foreground mb-3">{alert.description}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onAction?.(alert.id, "dispatch")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium ${colors.badge} text-white rounded hover:opacity-90 transition-smooth`}
          data-testid={`button-dispatch-${alert.id}`}
        >
          Dispatch Technician
        </button>
        <button
          onClick={() => onAction?.(alert.id, "details")}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth"
          data-testid={`button-details-${alert.id}`}
        >
          Details
        </button>
      </div>
    </div>
  );
}
