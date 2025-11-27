import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import FleetMap from "@/components/dashboard/fleet-map";
import AlertPanel from "@/components/dashboard/alert-panel";
import ServiceRequestsPanel from "@/components/dashboard/service-requests-panel";
import ContainerFleetStats from "@/components/dashboard/container-fleet-stats";
import ErrorBoundary from "@/components/error-boundary";
import { websocket } from "@/lib/websocket";
import { getAuthToken, useAuth, getCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";

export default function ClientDashboard() {
    const queryClient = useQueryClient();
    const authToken = getAuthToken();
    const { user } = useAuth();

    // Security: Only clients should see this dashboard
    const userRole = (user?.role || getCurrentUser()?.role || "client").toLowerCase();
    console.log(`[CLIENT DASHBOARD] User role check: ${userRole}`);

    if (userRole === "technician") {
        console.log(`[CLIENT DASHBOARD] Technician detected, redirecting to /my-profile`);
        return <Redirect to="/my-profile" />;
    }

    if (["admin", "coordinator", "super_admin"].includes(userRole)) {
        console.log(`[CLIENT DASHBOARD] Admin detected, redirecting to admin dashboard`);
        return <Redirect to="/" />;
    }

    // Fetch client's own containers only
    const { data: containers = [] } = useQuery<any[]>({
        queryKey: ["/api/customers/me/containers"],
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/customers/me/containers");
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        staleTime: 30000,
        refetchInterval: 60000,
    });

    // Fetch alerts for client's containers
    const { data: allAlerts = [] } = useQuery<any[]>({
        queryKey: ["/api/alerts"],
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/alerts");
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        staleTime: 30000,
        refetchInterval: 60000,
    });

    // Filter alerts to only show those related to client's containers
    const containerIds = containers.map(c => c.id);
    const clientAlerts = allAlerts.filter(alert =>
        containerIds.includes(alert.containerId) ||
        containerIds.includes(alert.container_id)
    );

    // Fetch service requests for client's containers
    const { data: allServiceRequests = [] } = useQuery<any[]>({
        queryKey: ["/api/service-requests"],
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/service-requests");
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        staleTime: 30000,
        refetchInterval: 60000,
    });

    // Filter service requests to only show those related to client's containers
    const clientServiceRequests = allServiceRequests.filter(request =>
        containerIds.includes(request.containerId) ||
        containerIds.includes(request.container_id)
    );

    // Calculate client-specific stats
    const stats = {
        totalContainers: containers.length,
        activeAlerts: clientAlerts.filter(a => a.status === 'active' || a.status === 'critical').length,
        pendingRequests: clientServiceRequests.filter(r => r.status === 'pending' || r.status === 'approved').length,
        activeContainers: containers.filter(c => c.status === 'active' || c.status === 'operational').length,
    };

    // WebSocket for real-time updates
    useEffect(() => {
        if (!authToken) return;

        console.log("[CLIENT DASHBOARD] Connecting to WebSocket...");
        websocket.connect(authToken);

        const handleUpdate = (data: any) => {
            console.log("[CLIENT DASHBOARD] Received update:", data.type);

            // Only invalidate if the update is related to this client's data
            if (data.type === "container_updated" && containerIds.includes(data.data?.id)) {
                queryClient.invalidateQueries({ queryKey: ["/api/customers/me/containers"] });
            }

            if (data.type === "alert_created" && containerIds.includes(data.data?.containerId)) {
                queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
            }

            if (data.type === "service_request_updated" && containerIds.includes(data.data?.containerId)) {
                queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
            }
        };

        websocket.on("container_updated", handleUpdate);
        websocket.on("alert_created", handleUpdate);
        websocket.on("alert_updated", handleUpdate);
        websocket.on("service_request_created", handleUpdate);
        websocket.on("service_request_updated", handleUpdate);

        return () => {
            websocket.off("container_updated", handleUpdate);
            websocket.off("alert_created", handleUpdate);
            websocket.off("alert_updated", handleUpdate);
            websocket.off("service_request_created", handleUpdate);
            websocket.off("service_request_updated", handleUpdate);
        };
    }, [authToken, queryClient, containerIds]);

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col">
                <Header title="My Dashboard" />
                <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6">

                    {/* Client KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm font-medium">My Containers</p>
                                    <h3 className="text-3xl font-bold mt-2">{stats.totalContainers}</h3>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <i className="fas fa-box text-2xl"></i>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-100 text-sm font-medium">Active Containers</p>
                                    <h3 className="text-3xl font-bold mt-2">{stats.activeContainers}</h3>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <i className="fas fa-check-circle text-2xl"></i>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-100 text-sm font-medium">Active Alerts</p>
                                    <h3 className="text-3xl font-bold mt-2">{stats.activeAlerts}</h3>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <i className="fas fa-exclamation-triangle text-2xl"></i>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-sm font-medium">Service Requests</p>
                                    <h3 className="text-3xl font-bold mt-2">{stats.pendingRequests}</h3>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <i className="fas fa-wrench text-2xl"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Map & Alerts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 h-auto lg:h-[600px]">
                        <div className="lg:col-span-2 h-[350px] lg:h-full min-h-0">
                            <ErrorBoundary>
                                <div className="h-full">
                                    <FleetMap containers={containers} />
                                </div>
                            </ErrorBoundary>
                        </div>
                        <div className="h-[350px] lg:h-full min-h-0">
                            <ErrorBoundary>
                                <div className="h-full">
                                    <AlertPanel alerts={clientAlerts} containers={containers} />
                                </div>
                            </ErrorBoundary>
                        </div>
                    </div>

                    {/* Service Requests & Container Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        <ErrorBoundary>
                            <ServiceRequestsPanel requests={clientServiceRequests} containers={containers} />
                        </ErrorBoundary>
                        <ErrorBoundary>
                            <ContainerFleetStats containers={containers} />
                        </ErrorBoundary>
                    </div>

                    {/* Welcome Message */}
                    {containers.length === 0 && (
                        <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                                <i className="fas fa-box text-primary text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Welcome to Your Dashboard!</h3>
                            <p className="text-muted-foreground mb-4">
                                You don't have any containers assigned yet. Please contact your account manager to get started.
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
