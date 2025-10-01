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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Fleet */}
      <div className="bg-card border border-border rounded-lg p-6 hover-lift transition-smooth">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <i className="fas fa-box text-primary text-xl"></i>
          </div>
          <span className="text-xs text-success font-medium">+12% vs last month</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.totalContainers || 0}</h3>
        <p className="text-sm text-muted-foreground mt-1">Total Containers</p>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">IoT:</span>
          <span className="font-medium text-primary">90</span>
          <span className="text-muted-foreground">Manual:</span>
          <span className="font-medium text-muted">160</span>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-card border border-border rounded-lg p-6 hover-lift transition-smooth">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-destructive/10 rounded-lg">
            <i className="fas fa-exclamation-triangle text-destructive text-xl"></i>
          </div>
          <span className="text-xs text-destructive font-medium">3 Critical</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.activeAlerts || 0}</h3>
        <p className="text-sm text-muted-foreground mt-1">Active Alerts</p>
        <div className="mt-4 flex gap-2">
          <span className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs rounded-full">3 Critical</span>
          <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full">5 High</span>
          <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">4 Med</span>
        </div>
      </div>

      {/* Service Requests */}
      <div className="bg-card border border-border rounded-lg p-6 hover-lift transition-smooth">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-warning/10 rounded-lg">
            <i className="fas fa-wrench text-warning text-xl"></i>
          </div>
          <span className="text-xs text-success font-medium">95% on-time</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.pendingServices || 0}</h3>
        <p className="text-sm text-muted-foreground mt-1">Pending Services</p>
        <div className="mt-4 text-xs text-muted-foreground">
          Avg TAT: <span className="font-medium text-foreground">4.2 hrs</span>
        </div>
      </div>

      {/* Fleet Utilization */}
      <div className="bg-card border border-border rounded-lg p-6 hover-lift transition-smooth">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-secondary/10 rounded-lg">
            <i className="fas fa-chart-pie text-secondary text-xl"></i>
          </div>
          <span className="text-xs text-success font-medium">+8% efficiency</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.fleetUtilization || 0}%</h3>
        <p className="text-sm text-muted-foreground mt-1">Fleet Utilization</p>
        <div className="mt-4 w-full bg-muted/30 rounded-full h-2">
          <div
            className="bg-secondary h-2 rounded-full"
            style={{ width: `${stats?.fleetUtilization || 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
