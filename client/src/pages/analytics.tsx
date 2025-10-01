import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function Analytics() {
  const authToken = getAuthToken();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Analytics & Reports" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <i className="fas fa-chart-line text-primary text-2xl"></i>
                <span className="text-xs text-success">+15%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">{stats?.totalContainers || 0}</h3>
              <p className="text-sm text-muted-foreground">Total Fleet</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <i className="fas fa-clock text-warning text-2xl"></i>
                <span className="text-xs text-success">-20%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">4.2h</h3>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <i className="fas fa-check-circle text-success text-2xl"></i>
                <span className="text-xs text-success">+5%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">95%</h3>
              <p className="text-sm text-muted-foreground">First-Time Fix Rate</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <i className="fas fa-dollar-sign text-accent text-2xl"></i>
                <span className="text-xs text-success">+12%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">$125K</h3>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
          </div>

          {/* Charts Placeholder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Service Volume Trends</h3>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Chart visualization coming soon...</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Alert Distribution</h3>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Chart visualization coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
