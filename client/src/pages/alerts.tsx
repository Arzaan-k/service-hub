import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AlertItem from "@/components/alert-item";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { websocket } from "@/lib/websocket";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";

// Filter state interface
interface AlertFilters {
  search: string;
  severity: string;
  status: string;
  containerType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function Alerts() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AlertFilters>({
    search: '',
    severity: 'all',
    status: 'all',
    containerType: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const { data: alerts = [] } = useQuery<any[]>({ 
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/alerts");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: containers = [] } = useQuery<any[]>({ 
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Filter and sort alerts
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(alert => {
        const container = containers.find((c: any) => c.id === alert.containerId);
        return (
          alert.title?.toLowerCase().includes(searchLower) ||
          alert.description?.toLowerCase().includes(searchLower) ||
          alert.alertCode?.toLowerCase().includes(searchLower) ||
          container?.containerCode?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Severity filter
    if (filters.severity !== 'all') {
      result = result.filter(alert => alert.severity === filters.severity);
    }

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'open') {
        result = result.filter(alert => !alert.resolvedAt && !alert.acknowledgedAt);
      } else if (filters.status === 'acknowledged') {
        result = result.filter(alert => alert.acknowledgedAt && !alert.resolvedAt);
      } else if (filters.status === 'resolved') {
        result = result.filter(alert => alert.resolvedAt);
      }
    }

    // Container type filter
    if (filters.containerType !== 'all') {
      result = result.filter(alert => {
        const container = containers.find((c: any) => c.id === alert.containerId);
        return container?.type?.toLowerCase() === filters.containerType;
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
                       (severityOrder[a.severity as keyof typeof severityOrder] || 0);
          break;
        case 'container':
          const containerA = containers.find((c: any) => c.id === a.containerId)?.containerCode || '';
          const containerB = containers.find((c: any) => c.id === b.containerId)?.containerCode || '';
          comparison = containerA.localeCompare(containerB);
          break;
        default:
          comparison = 0;
      }
      return filters.sortOrder === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [alerts, containers, filters]);

  const clearFilters = () => {
    setFilters({
      search: '',
      severity: 'all',
      status: 'all',
      containerType: 'all',
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = filters.search || filters.severity !== 'all' || 
    filters.status !== 'all' || filters.containerType !== 'all';

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/alerts/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  });

  // Live updates via WebSocket: refresh alerts/stats when new alerts are created/resolved/acknowledged
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    };

    websocket.on("alert_created", refresh);
    websocket.on("alert_resolved", refresh);
    websocket.on("alert_acknowledged", refresh);

    return () => {
      websocket.off("alert_created", refresh);
      websocket.off("alert_resolved", refresh);
      websocket.off("alert_acknowledged", refresh);
    };
  }, [queryClient]);

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/alerts/${id}/resolve`, { resolutionMethod: "service" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  });

  const dispatch = useMutation({
    mutationFn: async (alertId: string) => {
      // Create a service request from alert
      await apiRequest("POST", "/api/service-requests", { alertId, issueDescription: "Auto-dispatch from alert" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
    }
  });


  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Alerts & Monitoring" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Search and Filter Bar */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search alerts, containers..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="pl-9"
                />
              </div>

              {/* Filter Toggle */}
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    !
                  </Badge>
                )}
              </Button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
                  <Select value={filters.severity} onValueChange={(v) => setFilters(f => ({ ...f, severity: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="acknowledged">Acknowledged</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Container Type</label>
                  <Select value={filters.containerType} onValueChange={(v) => setFilters(f => ({ ...f, containerType: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="refrigerated">Refrigerated</SelectItem>
                      <SelectItem value="dry">Dry</SelectItem>
                      <SelectItem value="iot_enabled">IoT Enabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
                  <div className="flex gap-2">
                    <Select value={filters.sortBy} onValueChange={(v) => setFilters(f => ({ ...f, sortBy: v }))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="severity">Severity</SelectItem>
                        <SelectItem value="container">Container</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setFilters(f => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                    >
                      <ArrowUpDown className={`h-4 w-4 ${filters.sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Results count */}
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredAlerts.length} of {alerts.length} alerts
            </div>
          </div>

          {/* Alerts Grouped by Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {(() => {
              // Group alerts by container
              const alertsByContainer = filteredAlerts?.reduce((acc: any, alert: any) => {
                const containerId = alert.containerId;
                if (!acc[containerId]) {
                  acc[containerId] = {
                    container: containers?.find((c: any) => c.id === containerId),
                    alerts: []
                  };
                }
                acc[containerId].alerts.push(alert);
                return acc;
              }, {}) || {};

              return Object.entries(alertsByContainer).map(([containerId, { container, alerts: containerAlerts }]: [string, any]) => (
                <div key={containerId} className="bg-card border border-border rounded-lg p-4 shadow-soft">
                  {/* Container Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                    <div>
                      <h3 className="text-lg font-semibold font-mono">
                        {container?.containerCode || "Unknown Container"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {container?.type || "Unknown Type"} • {containerAlerts.length} alert{containerAlerts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status indicator for container */}
                      <div className={`w-3 h-3 rounded-full ${
                        containerAlerts.some((a: any) => a.severity === 'critical') ? 'bg-red-500' :
                        containerAlerts.some((a: any) => a.severity === 'high') ? 'bg-orange-500' :
                        containerAlerts.some((a: any) => a.severity === 'medium') ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}></div>
                    </div>
                  </div>

                  {/* Scrollable Alerts List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {containerAlerts.map((alert: any) => (
                      <AlertItem
                        key={alert.id}
                        alert={alert}
                        containerName={container?.containerCode || "Unknown"}
                        containerModel={container?.type || "Unknown"}
                        onAction={(id, action) => {
                          if (action === "acknowledge") acknowledge.mutate(id);
                          if (action === "resolve") resolve.mutate(id);
                          if (action === "dispatch") dispatch.mutate(id);
                        }}
                      />
                    ))}
                  </div>

                  {/* Container Actions */}
                  {container && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLocation(`/containers/${container.id}`)}
                          className="flex-1 px-3 py-2 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth"
                        >
                          View Container
                        </button>
                        <button
                          onClick={() => {
                            // Bulk acknowledge all alerts for this container
                            containerAlerts.forEach((alert: any) => {
                              acknowledge.mutate(alert.id);
                            });
                          }}
                          className="px-3 py-2 text-xs font-medium border border-blue-500/30 text-blue-400 rounded hover:bg-blue-500/10 transition-smooth"
                          disabled={acknowledge.isPending}
                        >
                          {acknowledge.isPending ? "Processing..." : "Ack All"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
