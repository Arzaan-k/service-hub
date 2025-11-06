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
      critical: { bg: "bg-red-950/50", border: "border-red-500/30", text: "text-red-400", badge: "bg-red-600" },
      high: { bg: "bg-orange-950/50", border: "border-orange-500/30", text: "text-orange-400", badge: "bg-orange-600" },
      medium: { bg: "bg-yellow-950/50", border: "border-yellow-500/30", text: "text-yellow-400", badge: "bg-yellow-600" },
      low: { bg: "bg-gray-800/50", border: "border-gray-600/30", text: "text-gray-400", badge: "bg-gray-600" },
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
    <div className="bg-card border border-alerts/20 rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Active Alerts</h3>
        </div>
        <button className="text-xs text-red-400 hover:text-red-300 transition-colors">View All</button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-thin">
        {alerts.slice(0, 5).map((alert) => {
          const container = containers.find((c) => c.id === alert.containerId);
          const colors = getSeverityColors(alert.severity);

            return (
              <div 
                key={alert.id} 
                className={`p-4 ${colors.bg} border ${colors.border} rounded-lg`}
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`px-2 py-1 ${colors.badge} text-white text-xs font-semibold rounded uppercase whitespace-nowrap`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {new Date(alert.detectedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className={`w-2 h-2 ${colors.badge} rounded-full animate-pulse`}></div>
                </div>
                
                <p className={`text-sm font-semibold ${colors.text} mb-2`}>{alert.title}</p>
                
                <p className="text-xs text-gray-400 mb-3">
                  {container?.containerCode || container?.containerId || "Unknown"}
                </p>
                
                <p className="text-xs text-gray-300 mb-3 leading-relaxed">{alert.description}</p>
                
                {alert.aiClassification && (
                  <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                    <span className="font-semibold">AI Analysis:</span> {alert.aiClassification.rootCause}
                  </p>
                )}
                
                <div className="flex gap-2">
                  <button
                    className={`flex-1 px-3 py-2 text-xs font-medium ${colors.badge} text-white rounded hover:opacity-80 transition-opacity`}
                  >
                    Dispatch Technician
                  </button>
                  <button className="px-4 py-2 text-xs font-medium border border-gray-600 text-gray-300 rounded hover:bg-gray-800 transition-colors">
                    Details
                  </button>
                </div>
              </div>
            );
          }) : (
            <p className="text-sm text-gray-400 text-center py-8">No active alerts</p>
          )}
        </div>
      </div>
    </div>
  );
}