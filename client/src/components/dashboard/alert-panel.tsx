import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, SortAsc, SortDesc } from "lucide-react";

interface Alert {
  id: string;
  severity: string;
  title: string;
  description: string;
  detectedAt: string;
  containerId: string;
  aiClassification?: any;
}

interface AlertPanelProps {
  alerts: Alert[];
  containers: any[];
}

interface AlertCardContentProps {
  alert: Alert;
  container: any;
  colors: any;
}

function AlertCardContent({ alert, container, colors }: AlertCardContentProps) {
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 ${colors.badge} text-white text-[10px] font-bold rounded-md uppercase tracking-wider shadow-sm`}
          >
            {alert.severity}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <i className="far fa-clock"></i>
            {new Date(alert.detectedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className={`w-2 h-2 ${colors.badge} rounded-full animate-pulse shadow-[0_0_8px_currentColor]`}></div>
      </div>

      <p className={`text-sm font-bold ${colors.text} mb-1 leading-tight`}>{alert.title}</p>
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
        <p className="text-xs font-mono text-muted-foreground">
          {container?.containerCode || container?.containerId || "Unknown"}
        </p>
      </div>

      <p className="text-xs text-foreground/90 mb-3 leading-relaxed bg-muted/50 p-2 rounded-lg border border-border/50">
        {alert.description}
      </p>

      {alert.aiClassification && (
        <div className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-1.5 mb-1">
            <i className="fas fa-robot text-primary text-xs"></i>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI Analysis</span>
          </div>
          <p className="text-xs text-foreground/90">
            {alert.aiClassification.rootCause}
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-auto pt-2 border-t border-border/50">
        <button
          className={`flex-1 px-3 py-2 text-xs font-bold ${colors.badge} text-white rounded-lg hover:opacity-90 transition-all shadow-md hover:shadow-lg`}
        >
          Dispatch Tech
        </button>
        <button className="px-3 py-2 text-xs font-bold border border-border bg-secondary/50 text-foreground rounded-lg hover:bg-secondary transition-all">
          Details
        </button>
      </div>
    </>
  );
}

import { GlassCard } from "@/components/ui/animated-card";

export default function AlertPanel({ alerts, containers }: AlertPanelProps) {
  const [, setLocation] = useLocation();

  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort alerts
  const filteredAndSortedAlerts = useMemo(() => {
    let filtered = alerts.filter(alert => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const container = containers?.find((c: any) =>
          c.id === alert.containerId ||
          c.containerId === alert.containerId ||
          c.container_id === alert.containerId
        );
        const matchesSearch =
          alert.title.toLowerCase().includes(searchLower) ||
          alert.description.toLowerCase().includes(searchLower) ||
          container?.containerCode?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Severity filter
      if (severityFilter !== "all" && alert.severity !== severityFilter) {
        return false;
      }

      return true;
    });

    // Sort alerts
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        case "oldest":
          return new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
        case "severity":
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
        case "container":
          const containerA = containers?.find((c: any) => c.id === a.containerId)?.containerCode || "";
          const containerB = containers?.find((c: any) => c.id === b.containerId)?.containerCode || "";
          return containerA.localeCompare(containerB);
        default:
          return 0;
      }
    });

    return filtered;
  }, [alerts, containers, searchTerm, severityFilter, sortBy]);

  const getSeverityColors = (severity: string) => {
    const colors = {
      critical: {
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        text: "text-red-500",
        badge: "bg-red-500",
      },
      high: {
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        text: "text-orange-500",
        badge: "bg-orange-500",
      },
      medium: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        text: "text-blue-500",
        badge: "bg-blue-500",
      },
      low: {
        bg: "bg-gray-500/10",
        border: "border-gray-500/20",
        text: "text-gray-500",
        badge: "bg-gray-500",
      },
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };


  return (
    <GlassCard className="h-full w-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-xl">
            <i className="fas fa-exclamation-triangle text-red-500 text-lg"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">Active Alerts</h3>
            <p className="text-xs text-muted-foreground">{filteredAndSortedAlerts.length} of {alerts.length} alerts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 w-8 p-0"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <button className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wider">View All</button>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/5 border-white/10"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
                <SelectValue placeholder="All Severities" />
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 w-auto text-xs bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="container">Container</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSeverityFilter("all");
                setSortBy("newest");
              }}
              className="h-7 text-xs"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1" style={{ overflow: 'hidden', minHeight: 0 }}>
        <div style={{ height: '100%', overflowY: 'auto' }} className="scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {filteredAndSortedAlerts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {alerts.length === 0 ? "No active alerts" : "No alerts match your filters"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {alerts.length === 0 ? "Try simulating an alert above" : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedAlerts.map((alert) => {
                const container = containers?.find((c: any) =>
                  c.id === alert.containerId ||
                  c.containerId === alert.containerId ||
                  c.container_id === alert.containerId
                );
                const colors = getSeverityColors(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`p-4 ${colors.bg} border ${colors.border} rounded-lg transition-all hover:scale-[1.01] duration-200 cursor-pointer`}
                    onClick={() => container && setLocation(`/containers/${container.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${colors.badge} text-white text-[10px] font-bold uppercase tracking-wider border-0`}
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {new Date(alert.detectedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`w-2 h-2 ${colors.badge} rounded-full animate-pulse`}></div>
                    </div>

                    <h4 className={`text-sm font-bold ${colors.text} mb-2 leading-tight`}>{alert.title}</h4>

                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {container?.containerCode || "Unknown"}
                      </span>
                      {container?.type && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{container.type}</span>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-foreground/90 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                      {alert.description}
                    </div>

                    {alert.aiClassification && (
                      <div className="mt-3 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <i className="fas fa-robot text-indigo-500 text-xs"></i>
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">AI Analysis</span>
                        </div>
                        <p className="text-xs text-foreground/90">
                          {alert.aiClassification.rootCause}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
