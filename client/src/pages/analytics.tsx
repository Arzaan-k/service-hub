import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  DollarSign,
  Activity,
  Users,
  Package,
} from "lucide-react";

const COLORS = ["#ef4444", "#FF9013", "#73C8D2", "#73C8D2", "#0046FF", "#0046FF"];

export default function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: alerts } = useQuery({
    queryKey: ["/api/alerts"],
  });

  const { data: serviceRequests } = useQuery({
    queryKey: ["/api/service-requests"],
  });

  // Process data for charts
  const serviceVolumeData = [
    { month: "Jan", services: 45, alerts: 32 },
    { month: "Feb", services: 52, alerts: 41 },
    { month: "Mar", services: 61, alerts: 38 },
    { month: "Apr", services: 58, alerts: 45 },
    { month: "May", services: 70, alerts: 52 },
    { month: "Jun", services: 65, alerts: 48 },
  ];

  const alertDistribution = alerts
    ? Object.entries(
        alerts.reduce((acc: any, alert: any) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }))
    : [
        { name: "Critical", value: 5 },
        { name: "High", value: 12 },
        { name: "Medium", value: 25 },
        { name: "Low", value: 18 },
      ];

  const serviceStatusData = serviceRequests
    ? Object.entries(
        serviceRequests.reduce((acc: any, sr: any) => {
          acc[sr.status] = (acc[sr.status] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }))
    : [
        { name: "Pending", value: 8 },
        { name: "Scheduled", value: 15 },
        { name: "In Progress", value: 5 },
        { name: "Completed", value: 45 },
      ];

  const performanceData = [
    { metric: "Response Time", current: 4.2, target: 6.0, unit: "hours" },
    { metric: "Fix Rate", current: 95, target: 90, unit: "%" },
    { metric: "CSAT Score", current: 4.7, target: 4.5, unit: "/5" },
    { metric: "Utilization", current: 82, target: 80, unit: "%" },
  ];

  const kpiCards = [
    {
      title: "Total Fleet",
      value: stats?.totalContainers || 0,
      change: "+15%",
      trend: "up",
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Avg Response Time",
      value: "4.2h",
      change: "-20%",
      trend: "down",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "First-Time Fix Rate",
      value: "95%",
      change: "+5%",
      trend: "up",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Monthly Revenue",
      value: "$125K",
      change: "+12%",
      trend: "up",
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Analytics & Reports" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiCards.map((kpi, index) => {
              const IconComponent = kpi.icon;
              return (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                        <IconComponent className={`h-6 w-6 ${kpi.color}`} />
                      </div>
                      <div
                        className={`flex items-center gap-1 text-xs font-medium ${
                          kpi.trend === "up" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {kpi.trend === "up" ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {kpi.change}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-1">{kpi.value}</h3>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Service Volume Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Service Volume Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={serviceVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="services" stroke="#3b82f6" strokeWidth={2} name="Services" />
                  <Line type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2} name="Alerts" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Alert Distribution & Service Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Alert Distribution by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={alertDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {alertDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service Request Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={serviceStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics vs Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {performanceData.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{metric.metric}</span>
                      <span className="text-sm font-medium text-foreground">
                        {metric.current}
                        {metric.unit}
                      </span>
                    </div>
                    <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          metric.current >= metric.target ? "bg-green-500" : "bg-orange-500"
                        }`}
                        style={{
                          width: `${Math.min((metric.current / metric.target) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Target: {metric.target}{metric.unit}</span>
                      <span
                        className={
                          metric.current >= metric.target ? "text-green-600" : "text-orange-600"
                        }
                      >
                        {metric.current >= metric.target ? "Above target" : "Below target"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Alerts (30d)</p>
                  <p className="text-3xl font-bold text-foreground">{alerts?.length || 0}</p>
                  <p className="text-xs text-green-600">+8% from last month</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Service Requests (30d)</p>
                  <p className="text-3xl font-bold text-foreground">{serviceRequests?.length || 0}</p>
                  <p className="text-xs text-green-600">+12% from last month</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Active Technicians</p>
                  <p className="text-3xl font-bold text-foreground">12</p>
                  <p className="text-xs text-muted-foreground">85% utilization</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
