import { useState } from "react";
import { GlassCard } from "@/components/ui/animated-card";
import { Search, Box, Activity, Zap, CheckCircle, MessageCircle } from "lucide-react";

interface ContainerLookupProps {
  containers: any[];
}

export default function ContainerLookup({ containers }: ContainerLookupProps) {
  const [searchId, setSearchId] = useState("");
  const selectedContainer = containers?.find((c) => c.containerId === searchId || c.containerCode === searchId);

  return (
    <GlassCard className="h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-xl">
          <Search className="h-5 w-5 text-blue-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground tracking-tight">Quick Lookup</h3>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Enter Container ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-muted-foreground/50"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            data-testid="input-container-search"
          />
        </div>

        {selectedContainer && (
          <div className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-mono font-bold text-foreground tracking-wider">{selectedContainer.containerCode || selectedContainer.containerId}</p>
              </div>
              <span
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md border ${selectedContainer.status === "active"
                    ? "bg-green-500/20 text-green-500 border-green-500/30"
                    : "bg-red-500/20 text-red-500 border-red-500/30"
                  }`}
              >
                {selectedContainer.status}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                <span className="text-muted-foreground font-medium">Type</span>
                <span className="font-bold text-foreground">{selectedContainer.type || "Standard"}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                <span className="text-muted-foreground font-medium">Location</span>
                <span className="font-bold text-foreground text-right max-w-[150px] truncate">
                  {selectedContainer.currentLocation?.address || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                <span className="text-muted-foreground font-medium">Last Sync</span>
                <span className="font-bold text-foreground">
                  {selectedContainer.lastSyncTime
                    ? new Date(selectedContainer.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                <span className="text-muted-foreground font-medium">Health Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(selectedContainer.healthScore || 0) > 80 ? 'bg-green-500' :
                          (selectedContainer.healthScore || 0) > 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      style={{ width: `${selectedContainer.healthScore || 0}%` }}
                    />
                  </div>
                  <span className="font-bold text-foreground">{selectedContainer.healthScore || 0}%</span>
                </div>
              </div>
            </div>

            <button className="w-full mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40">
              View Full Details
            </button>
          </div>
        )}

        {!selectedContainer && searchId && (
          <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10 border-dashed">
            <p className="text-sm font-medium text-muted-foreground">No container found</p>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Activity</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
              <div className="p-1.5 bg-red-500/10 rounded-md group-hover:bg-red-500/20 transition-colors">
                <Zap className="h-3 w-3 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">Power failure detected</p>
                <p className="text-[10px] text-muted-foreground">2 min ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
              <div className="p-1.5 bg-green-500/10 rounded-md group-hover:bg-green-500/20 transition-colors">
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">Technician dispatched</p>
                <p className="text-[10px] text-muted-foreground">5 min ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
              <div className="p-1.5 bg-blue-500/10 rounded-md group-hover:bg-blue-500/20 transition-colors">
                <MessageCircle className="h-3 w-3 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">Client notified via WhatsApp</p>
                <p className="text-[10px] text-muted-foreground">6 min ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
