import { useState } from "react";

interface ContainerLookupProps {
  containers: any[];
}

export default function ContainerLookup({ containers }: ContainerLookupProps) {
  const [searchId, setSearchId] = useState("");
  const selectedContainer = containers?.find((c) => c.containerId === searchId);

  return (
    <div className="bg-card border border-containers/20 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-containers/10 rounded-lg">
          <i className="fas fa-search text-containers text-sm"></i>
        </div>
        <h3 className="text-lg font-semibold text-foreground">Quick Container Lookup</h3>
      </div>

      <div className="space-y-4">
        <div>
          <input
            type="text"
            placeholder="Enter Container ID..."
            className="w-full px-4 py-2 bg-muted/20 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            data-testid="input-container-search"
          />
        </div>

        {selectedContainer && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-mono font-semibold text-foreground">{selectedContainer.containerId}</p>
              <span
                className={`px-2 py-0.5 ${
                  selectedContainer.status === "active"
                    ? "bg-success text-success-foreground"
                    : "bg-destructive text-destructive-foreground"
                } text-xs rounded-full`}
              >
                {selectedContainer.status}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium text-foreground">{selectedContainer.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium text-foreground">
                  {selectedContainer.currentLocation?.address || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Sync:</span>
                <span className="font-medium text-foreground">
                  {selectedContainer.lastSyncTime
                    ? new Date(selectedContainer.lastSyncTime).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Health Score:</span>
                <span className="font-medium text-foreground">{selectedContainer.healthScore}%</span>
              </div>
            </div>

            <button className="w-full mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-smooth">
              View Full Details
            </button>
          </div>
        )}

        {!selectedContainer && searchId && (
          <p className="text-sm text-muted-foreground text-center py-4">No container found</p>
        )}

        {/* Recent Activity */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-destructive rounded-full mt-1.5"></div>
              <div className="flex-1">
                <p className="text-xs text-foreground">Power failure detected</p>
                <p className="text-xs text-muted-foreground">2 min ago</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-success rounded-full mt-1.5"></div>
              <div className="flex-1">
                <p className="text-xs text-foreground">Technician dispatched</p>
                <p className="text-xs text-muted-foreground">5 min ago</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
              <div className="flex-1">
                <p className="text-xs text-foreground">Client notified via WhatsApp</p>
                <p className="text-xs text-muted-foreground">6 min ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
