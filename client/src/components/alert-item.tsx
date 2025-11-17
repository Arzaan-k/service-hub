import React, { useState } from "react";
import { Wrench, ChevronDown, ChevronUp } from "lucide-react";
import ReeferDiagnosticChat from "./rag/ReeferDiagnosticChat";

interface AlertItemProps {
  alert: {
    id: string;
    severity: string;
    alertCode: string;
    description: string;
    detectedAt: string;
    containerId: string;
    aiClassification?: { summary?: string; confidence?: string; sources?: any[] };
    resolutionSteps?: string[];
  };
  containerName: string;
  containerModel?: string;
  onAction?: (alertId: string, action: string) => void;
}

export default function AlertItem({ alert, containerName, containerModel, onAction }: AlertItemProps) {
  const [showChat, setShowChat] = useState(false);

  const severityColors = {
    critical: { stripe: "#FF6F61", text: "text-destructive", badge: "bg-destructive" },
    high: { stripe: "#FFCBA4", text: "text-warning", badge: "bg-warning" },
    medium: { stripe: "#FFD4E3", text: "text-accent", badge: "bg-accent" },
    low: { stripe: "#FFE0D6", text: "text-muted-foreground", badge: "bg-muted" },
  };

  const colors = severityColors[alert.severity as keyof typeof severityColors] || severityColors.medium;

  return (
    <div
      className="alert-card p-3 border rounded-xl shadow-soft relative"
      style={{ borderColor: "#FFE0D6", borderLeftColor: colors.stripe, borderLeftWidth: 4 }}
      data-testid={`alert-item-${alert.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 ${colors.badge} text-white text-xs font-medium rounded uppercase`}>
            {alert.severity}
          </span>
          <span className="text-xs text-muted-foreground">{new Date(alert.detectedAt).toLocaleString()}</span>
        </div>
        <div className={`w-2 h-2 ${colors.badge} rounded-full pulse-indicator`}></div>
      </div>
      <p className={`text-sm font-medium ${colors.text} mb-1`}>{alert.alertCode}</p>
      <p className="text-xs text-muted-foreground mb-2">{containerName}</p>
      <p className="text-xs text-foreground mb-3">{alert.description}</p>

      {/* AI Insight */}
      {(alert.aiClassification?.summary || (alert.resolutionSteps && alert.resolutionSteps.length)) && (
        <div className="mb-3 p-3 bg-white border rounded-lg shadow-soft" style={{ borderColor: "#FFE0D6" }}>
          <div className="text-xs font-semibold text-foreground mb-1">AI Insight</div>
          {alert.aiClassification?.summary && (
            <p className="text-xs text-foreground mb-2">{alert.aiClassification.summary}</p>
          )}
          {alert.resolutionSteps && alert.resolutionSteps.length > 0 && (
            <ol className="list-decimal list-inside space-y-1 text-xs text-foreground">
              {alert.resolutionSteps.slice(0,6).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {alert.aiClassification?.sources && alert.aiClassification.sources.length > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Sources: {alert.aiClassification.sources.slice(0,3).map((src: any, idx: number) => (
                <span key={idx} className="mr-2">{src.manual_name} p.{src.page}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAction?.(alert.id, "acknowledge")}
          className="btn-secondary px-3 py-1.5 text-xs font-medium rounded"
          data-testid={`button-ack-${alert.id}`}
        >
          Acknowledge
        </button>
        <button
          onClick={() => onAction?.(alert.id, "resolve")}
          className="btn-secondary px-3 py-1.5 text-xs font-medium rounded"
          data-testid={`button-resolve-${alert.id}`}
        >
          Resolve
        </button>
        <button
          onClick={() => onAction?.(alert.id, "dispatch")}
          className={`btn-primary px-3 py-1.5 text-xs font-medium rounded`}
          data-testid={`button-dispatch-${alert.id}`}
        >
          Dispatch Technician
        </button>
        <button
          onClick={() => onAction?.(alert.id, "create_sr")}
          className="btn-secondary px-3 py-1.5 text-xs font-medium rounded"
        >
          Create Service Request
        </button>
        <button
          onClick={() => onAction?.(alert.id, "details")}
          className="btn-secondary px-3 py-1.5 text-xs font-medium rounded"
          data-testid={`button-details-${alert.id}`}
        >
          Details
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          className="btn-secondary px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1"
          data-testid={`button-troubleshoot-${alert.id}`}
        >
          <Wrench className="h-3 w-3" />
          {showChat ? (
            <>
              Hide Help
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Get Help
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      {showChat && (
        <div className="mt-4 pt-4 border-t border-border">
          <ReeferDiagnosticChat
            containerId={alert.containerId}
            containerModel={containerModel}
            alarmCode={alert.alertCode}
            compact={true}
            context={{
              alert_id: alert.id,
              alert_description: alert.description,
              container_name: containerName
            }}
          />
        </div>
      )}
    </div>
  );
}
