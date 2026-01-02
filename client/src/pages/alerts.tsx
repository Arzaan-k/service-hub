import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { websocket } from "@/lib/websocket";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, SlidersHorizontal, ArrowUpDown, Loader2 } from "lucide-react";
import { AlertSummaryPanel } from "@/components/alerts/alert-summary-panel";
import { ContainerAlertCard } from "@/components/alerts/container-alert-card";
import { AlertSidePanel } from "@/components/alerts/alert-side-panel";

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
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [visibleContainersCount, setVisibleContainersCount] = useState(20);

  const [filters, setFilters] = useState<AlertFilters>({
    search: '',
    severity: 'all',
    status: 'open', // Default to open alerts only as per requirements
    containerType: 'all',
    sortBy: 'severity', // Default sort by severity
    sortOrder: 'desc'
  });

  const { data: alerts = [], isLoading: isLoadingAlerts } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/alerts");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: containers = [], isLoading: isLoadingContainers } = useQuery<any[]>({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Filter alerts first
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

    return result;
  }, [alerts, containers, filters]);

  // Group alerts by container and sort containers
  const groupedContainers = useMemo(() => {
    const groups: Record<string, { container: any; alerts: any[]; score: number; lastAlert: string }> = {};

    filteredAlerts.forEach(alert => {
      const containerId = alert.containerId;
      if (!containerId) return; // Skip alerts without containerId

      if (!groups[containerId]) {
        const foundContainer = containers.find((c: any) => c.id === containerId);
        groups[containerId] = {
          // Provide fallback container if not found to prevent crashes
          container: foundContainer || { id: containerId, containerCode: 'Unknown', type: 'unknown' },
          alerts: [],
          score: 0,
          lastAlert: alert.createdAt
        };
      }

      groups[containerId].alerts.push(alert);

      // Update score for sorting
      const severityScore = { critical: 4, high: 3, medium: 2, low: 1 };
      groups[containerId].score += severityScore[alert.severity as keyof typeof severityScore] || 0;

      // Update last alert time
      if (new Date(alert.createdAt) > new Date(groups[containerId].lastAlert)) {
        groups[containerId].lastAlert = alert.createdAt;
      }
    });

    // Convert to array
    let result = Object.values(groups);

    // Sort containers
    result.sort((a, b) => {
      // Primary sort: User selection
      if (filters.sortBy === 'severity') {
        // Sort by total severity score
        if (a.score !== b.score) return filters.sortOrder === 'asc' ? a.score - b.score : b.score - a.score;
      } else if (filters.sortBy === 'date') {
        // Sort by most recent alert
        const timeA = new Date(a.lastAlert).getTime();
        const timeB = new Date(b.lastAlert).getTime();
        if (timeA !== timeB) return filters.sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      } else if (filters.sortBy === 'container') {
        const codeA = a.container?.containerCode || '';
        const codeB = b.container?.containerCode || '';
        return filters.sortOrder === 'asc' ? codeA.localeCompare(codeB) : codeB.localeCompare(codeA);
      }

      // Secondary sort: Recency (always desc unless overridden)
      return new Date(b.lastAlert).getTime() - new Date(a.lastAlert).getTime();
    });

    return result;
  }, [filteredAlerts, containers, filters]);

  // Calculate Summary Stats
  const summaryStats = useMemo(() => {
    const stats = {
      total: filteredAlerts.length,
      critical: filteredAlerts.filter(a => a.severity === 'critical').length,
      high: filteredAlerts.filter(a => a.severity === 'high').length,
      topContainer: null as { code: string; count: number } | null
    };

    if (groupedContainers.length > 0) {
      // Find container with most alerts
      const top = groupedContainers.reduce((prev, current) =>
        (prev.alerts.length > current.alerts.length) ? prev : current
      );
      stats.topContainer = {
        code: top.container?.containerCode || "Unknown",
        count: top.alerts.length
      };
    }

    return stats;
  }, [filteredAlerts, groupedContainers]);

  const clearFilters = () => {
    setFilters({
      search: '',
      severity: 'all',
      status: 'open',
      containerType: 'all',
      sortBy: 'severity',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = filters.search || filters.severity !== 'all' ||
    filters.status !== 'open' || filters.containerType !== 'all';

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

  // Live updates via WebSocket
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

  // Infinite scroll / Load more logic
  const visibleContainers = groupedContainers.slice(0, visibleContainersCount);
  const hasMore = visibleContainersCount < groupedContainers.length;

  const handleLoadMore = () => {
    setVisibleContainersCount(prev => prev + 20);
  };

  const observerTarget = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore]);

  const selectedContainerData = useMemo(() => {
    if (!selectedContainerId) return null;
    return groupedContainers.find(g => g.container?.id === selectedContainerId);
  }, [selectedContainerId, groupedContainers]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Alerts & Monitoring" />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Summary Panel */}
            <AlertSummaryPanel
              totalAlerts={summaryStats.total}
              criticalCount={summaryStats.critical}
              highCount={summaryStats.high}
              topContainer={summaryStats.topContainer}
            />

            {/* Search and Filter Bar */}
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
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
                          <SelectItem value="severity">Priority (Severity)</SelectItem>
                          <SelectItem value="date">Date (Recency)</SelectItem>
                          <SelectItem value="container">Container Name</SelectItem>
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
              <div className="mt-4 text-sm text-muted-foreground flex justify-between items-center">
                <span>Showing {filteredAlerts.length} alerts across {groupedContainers.length} containers</span>
                {isLoadingAlerts && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>

            {/* Container Cards List */}
            <div className="space-y-4">
              {visibleContainers.map(({ container, alerts }) => (
                <ContainerAlertCard
                  key={container?.id || 'unknown'}
                  container={container}
                  alerts={alerts}
                  allAlerts={filteredAlerts}
                  onViewAll={(id) => setSelectedContainerId(id)}
                  onAcknowledge={(id) => acknowledge.mutate(id)}
                  onResolve={(id) => resolve.mutate(id)}
                />
              ))}

              {visibleContainers.length === 0 && !isLoadingAlerts && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 rounded-full bg-muted/50">
                      <Search className="h-8 w-8 opacity-50" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium">No alerts found</h3>
                  <p>Try adjusting your filters or search criteria</p>
                </div>
              )}

              {/* Infinite Scroll Trigger */}
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center pt-4 pb-8">
                  <Button variant="ghost" onClick={handleLoadMore} disabled={true} className="w-full max-w-xs opacity-50">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading more...
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Panel for View All */}
        {selectedContainerData && (
          <AlertSidePanel
            isOpen={!!selectedContainerId}
            onClose={() => setSelectedContainerId(null)}
            container={selectedContainerData.container}
            alerts={selectedContainerData.alerts}
            onAcknowledge={(id) => acknowledge.mutate(id)}
            onResolve={(id) => resolve.mutate(id)}
          />
        )}
      </main>
    </div>
  );
}
