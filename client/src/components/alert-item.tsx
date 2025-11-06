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
      <p className={`text-sm font-medium ${colors.text} mb-1`}>{alert.alertCode}</p>
      <p className="text-xs text-muted-foreground mb-2">{containerName}</p>
      <p className="text-xs text-foreground mb-3">{alert.description}</p>

      {/* AI Insight */}
      {(alert.aiClassification?.summary || (alert.resolutionSteps && alert.resolutionSteps.length)) && (
        <div className="mb-3 p-3 bg-[#0e2038] border border-[#223351] rounded-lg">
          <div className="text-xs font-semibold text-white mb-1">AI Insight</div>
          {alert.aiClassification?.summary && (
            <p className="text-xs text-white mb-2">{alert.aiClassification.summary}</p>
          )}
          {alert.resolutionSteps && alert.resolutionSteps.length > 0 && (
            <ol className="list-decimal list-inside space-y-1 text-xs text-white">
              {alert.resolutionSteps.slice(0,6).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {alert.aiClassification?.sources && alert.aiClassification.sources.length > 0 && (
            <div className="mt-2 text-[11px] text-white/70">
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
          className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth"
          data-testid={`button-ack-${alert.id}`}
        >
          Acknowledge
        </button>
        <button
          onClick={() => onAction?.(alert.id, "resolve")}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth"
          data-testid={`button-resolve-${alert.id}`}
        >
          Resolve
        </button>
        <button
          onClick={() => onAction?.(alert.id, "dispatch")}
          className={`px-3 py-1.5 text-xs font-medium ${colors.badge} text-white rounded hover:opacity-90 transition-smooth`}
          data-testid={`button-dispatch-${alert.id}`}
        >
          Dispatch Technician
        </button>
        <button
          onClick={() => onAction?.(alert.id, "create_sr")}
          className="px-3 py-1.5 text-xs font-medium border border-green-500/40 text-green-400 rounded hover:bg-green-500/10 transition-smooth"
        >
          Create Service Request
        </button>
        <button
          onClick={() => onAction?.(alert.id, "details")}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth"
          data-testid={`button-details-${alert.id}`}
        >
          Details
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          className="px-3 py-1.5 text-xs font-medium border border-blue-400/30 text-blue-400 rounded hover:bg-blue-400/10 transition-smooth flex items-center gap-1"
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
