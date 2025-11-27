import { AnimatedCard } from "@/components/ui/animated-card";

interface KPICardsProps {
  stats?: {
    totalContainers: number;
    activeContainers: number;
    activeAlerts: number;
    pendingServices: number;
    fleetUtilization: number;
  };
}

export default function KPICards({ stats }: KPICardsProps) {
  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 lg:pb-0 lg:grid lg:grid-cols-4 lg:gap-6 no-scrollbar">
      {/* Total Fleet */}
      <div className="min-w-[85%] snap-center lg:min-w-0">
        <AnimatedCard gradientColor="#3B82F6" className="p-4 lg:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <i className="fas fa-box text-blue-500 text-xl"></i>
            </div>
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <i className="fas fa-arrow-up"></i> 12%
            </span>
          </div>
          <h3 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">{stats?.totalContainers || 0}</h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Total Containers</p>
          <div className="mt-4 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-muted-foreground">IoT: <span className="text-foreground font-semibold">90</span></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
              <span className="text-muted-foreground">Manual: <span className="text-foreground font-semibold">160</span></span>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Active Alerts */}
      <div className="min-w-[85%] snap-center lg:min-w-0">
        <AnimatedCard gradientColor="#EF4444" className="p-4 lg:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
            </div>
            <span className="text-xs text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded-full">
              3 Critical
            </span>
          </div>
          <h3 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">{stats?.activeAlerts || 0}</h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Active Alerts</p>
          <div className="mt-4 flex gap-2">
            <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider rounded-md">3 Crit</span>
            <span className="px-2 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider rounded-md">5 High</span>
            <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider rounded-md">4 Med</span>
          </div>
        </AnimatedCard>
      </div>

      {/* Service Requests */}
      <div className="min-w-[85%] snap-center lg:min-w-0">
        <AnimatedCard gradientColor="#F97316" className="p-4 lg:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <i className="fas fa-wrench text-orange-500 text-xl"></i>
            </div>
            <span className="text-xs text-green-500 font-medium">95% on-time</span>
          </div>
          <h3 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">{stats?.pendingServices || 0}</h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Pending Services</p>
          <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
            <i className="fas fa-clock"></i>
            Avg TAT: <span className="font-bold text-foreground">4.2 hrs</span>
          </div>
        </AnimatedCard>
      </div>

      {/* Fleet Utilization */}
      <div className="min-w-[85%] snap-center lg:min-w-0">
        <AnimatedCard gradientColor="#10B981" className="p-4 lg:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <i className="fas fa-chart-pie text-green-500 text-xl"></i>
            </div>
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <i className="fas fa-arrow-up"></i> 8%
            </span>
          </div>
          <h3 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">{stats?.fleetUtilization || 0}%</h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Fleet Utilization</p>
          <div className="mt-4 w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
              style={{ width: `${stats?.fleetUtilization || 0}%` }}
            ></div>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
