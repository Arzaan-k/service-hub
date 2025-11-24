import React from "react";

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

interface AlertCardContentProps {
  alert: Alert;
  container: any;
  colors: any;
}

function AlertCardContent({ alert, container, colors }: AlertCardContentProps) {
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 ${colors.badge} text-white text-[10px] font-bold rounded-md uppercase tracking-wider shadow-sm`}
          >
            {alert.severity}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <i className="far fa-clock"></i>
            {new Date(alert.detectedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className={`w-2 h-2 ${colors.badge} rounded-full animate-pulse shadow-[0_0_8px_currentColor]`}></div>
      </div>

      <p className={`text-sm font-bold ${colors.text} mb-1 leading-tight`}>{alert.title}</p>
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
        <p className="text-xs font-mono text-muted-foreground">
          {container?.containerCode || container?.containerId || "Unknown"}
        </p>
      </div>

      <p className="text-xs text-foreground/90 mb-3 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5">
        {alert.description}
      </p>

      {alert.aiClassification && (
        <div className="mb-3 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <i className="fas fa-robot text-indigo-500 text-xs"></i>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">AI Analysis</span>
          </div>
          <p className="text-xs text-foreground/90">
            {alert.aiClassification.rootCause}
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
        <button
          className={`flex-1 px-3 py-2 text-xs font-bold ${colors.badge} text-white rounded-lg hover:opacity-90 transition-all shadow-md hover:shadow-lg`}
        >
          Dispatch Tech
        </button>
        <button className="px-3 py-2 text-xs font-bold border border-white/10 bg-white/5 text-foreground rounded-lg hover:bg-white/10 transition-all">
          Details
        </button>
      </div>
    </>
  );
}

import { GlassCard } from "@/components/ui/animated-card";

export default function AlertPanel({ alerts, containers }: AlertPanelProps) {
  const getSeverityColors = (severity: string) => {
    const colors = {
      critical: {
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        text: "text-red-500",
        badge: "bg-red-500",
      },
      high: {
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        text: "text-orange-500",
        badge: "bg-orange-500",
      },
      medium: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        text: "text-blue-500",
        badge: "bg-blue-500",
      },
      low: {
        bg: "bg-gray-500/10",
        border: "border-gray-500/20",
        text: "text-gray-500",
        badge: "bg-gray-500",
      },
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  return (
    <GlassCard className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-xl">
            <i className="fas fa-exclamation-triangle text-red-500 text-lg"></i>
          </div>
          <h3 className="text-xl font-bold text-foreground tracking-tight">Active Alerts</h3>
        </div>
        <button className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wider">View All</button>
      </div>

      <div className="pr-2 scrollbar-thin flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {alerts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-check text-green-500"></i>
                </div>
                <p className="text-sm text-muted-foreground">No active alerts</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {alerts.map((alert) => {
                const container = containers.find(
                  (c) => c.id === alert.containerId
                );
                const colors = getSeverityColors(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`p-4 ${colors.bg} border ${colors.border} rounded-xl transition-all hover:scale-[1.02] duration-300`}
                  >
                    <AlertCardContent
                      alert={alert}
                      container={container}
                      colors={colors}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
