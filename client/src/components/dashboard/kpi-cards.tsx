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
      <div className="bg-card border border-containers/20 rounded-lg p-6 hover-lift transition-smooth" style={{ borderLeftColor: '#73C8D2', borderLeftWidth: '4px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-containers/10 rounded-lg" style={{ backgroundColor: 'rgba(115, 200, 210, 0.1)' }}>
            <i className="fas fa-box text-containers text-xl" style={{ color: '#73C8D2' }}></i>
          </div>
          <span className="text-xs text-success font-medium">+12% vs last month</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.totalContainers || 0}</h3>
        <p className="text-sm text-muted-foreground mt-1">Total Containers</p>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">IoT:</span>
          <span className="font-medium text-containers">90</span>
          <span className="text-muted-foreground">Manual:</span>
          <span className="font-medium text-muted">160</span>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-card border border-alerts/20 rounded-lg p-6 hover-lift transition-smooth" style={{ borderLeftColor: '#ef4444', borderLeftWidth: '4px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-alerts/10 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <i className="fas fa-exclamation-triangle text-alerts text-xl" style={{ color: '#ef4444' }}></i>
          </div>
          <span className="text-xs text-alerts font-medium" style={{ color: '#ef4444' }}>3 Critical</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.activeAlerts || 0}</h3>
        <p className="text-sm text-muted-foreground mt-1">Active Alerts</p>
        <div className="mt-4 flex gap-2">
          <span className="px-2 py-0.5 bg-alerts/20 text-alerts text-xs rounded-full">3 Critical</span>
          <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full">5 High</span>
          <span className="px-2 py-0.5 bg-info/20 text-info text-xs rounded-full">4 Med</span>
        </div>
      </div>

      {/* Service Requests */}
      <div className="bg-card border border-service/20 rounded-lg p-6 hover-lift transition-smooth" style={{ borderLeftColor: '#FF9013', borderLeftWidth: '4px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-service/10 rounded-lg" style={{ backgroundColor: 'rgba(255, 144, 19, 0.1)' }}>
            <i className="fas fa-wrench text-service text-xl" style={{ color: '#FF9013' }}></i>
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
      <div className="bg-card border border-dashboard/20 rounded-lg p-6 hover-lift transition-smooth" style={{ borderLeftColor: '#0046FF', borderLeftWidth: '4px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-dashboard/10 rounded-lg" style={{ backgroundColor: 'rgba(0, 70, 255, 0.1)' }}>
            <i className="fas fa-chart-pie text-dashboard text-xl" style={{ color: '#0046FF' }}></i>
          </div>
          <span className="text-xs text-success font-medium">+8% efficiency</span>
        </div>
        <h3 className="text-3xl font-bold text-foreground">{stats?.fleetUtilization || 0}%</h3>
        <p className="text-sm text-muted-foreground mt-1">Fleet Utilization</p>
        <div className="mt-4 w-full bg-muted/30 rounded-full h-2">
          <div
            className="bg-dashboard h-2 rounded-full"
            style={{ width: `${stats?.fleetUtilization || 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
