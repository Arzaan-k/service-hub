import { useState, useMemo } from "react";
import { format, subHours, isAfter, getHours } from "date-fns";
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle, AlertCircle, Info, CheckCircle2, Clock, Activity, BarChart3, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ContainerAnalytics } from "@/components/container/container-analytics-enhanced";

interface Alert {
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    createdAt: string;
    alertCode?: string;
    status?: string;
}

interface ContainerAlertCardProps {
    container: any;
    alerts: Alert[];
    allAlerts: Alert[]; // All alerts for analytics
    onViewAll: (containerId: string) => void;
    onAcknowledge: (alertId: string) => void;
    onResolve: (alertId: string) => void;
}

export function ContainerAlertCard({ container, alerts, allAlerts, onViewAll, onAcknowledge, onResolve }: ContainerAlertCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Smart Deduplication and Grouping Logic
    const groupedAlerts = useMemo(() => {
        const groups: Record<string, {
            id: string;
            title: string;
            description: string;
            severity: string;
            count: number;
            firstSeen: string;
            lastSeen: string;
            alertCode?: string;
            originalAlerts: Alert[];
        }> = {};

        alerts.forEach(alert => {
            // Aggressive cleaning for deduplication
            // Remove timestamps (HH:MM:SS, HH:MM)
            const timeRegex = /\b\d{1,2}:\d{2}(:\d{2})?\b/g;
            // Remove dates (YYYY-MM-DD)
            const dateRegex = /\b\d{4}-\d{2}-\d{2}\b/g;

            const cleanTitle = alert.title.replace(timeRegex, '').replace(dateRegex, '').trim();
            const cleanDesc = alert.description.replace(timeRegex, '').replace(dateRegex, '').trim();

            // Use cleaned content as the unique key
            const key = `${cleanTitle}|${cleanDesc}`;

            if (!groups[key]) {
                groups[key] = {
                    id: alert.id,
                    title: cleanTitle || alert.title,
                    description: cleanDesc || alert.description,
                    severity: alert.severity,
                    count: 0,
                    firstSeen: alert.createdAt,
                    lastSeen: alert.createdAt,
                    alertCode: alert.alertCode,
                    originalAlerts: []
                };
            }

            const group = groups[key];
            group.count++;
            group.originalAlerts.push(alert);

            // Update timestamps
            if (new Date(alert.createdAt) < new Date(group.firstSeen)) group.firstSeen = alert.createdAt;
            if (new Date(alert.createdAt) > new Date(group.lastSeen)) {
                group.lastSeen = alert.createdAt;
                group.id = alert.id;
            }

            // Upgrade severity
            const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
            if (severityWeight[alert.severity as keyof typeof severityWeight] > severityWeight[group.severity as keyof typeof severityWeight]) {
                group.severity = alert.severity;
            }
        });

        return Object.values(groups).sort((a, b) =>
            new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
        );
    }, [alerts]);

    // Analytics Data Preparation (Last 24 Hours)
    const analyticsData = useMemo(() => {
        const now = new Date();
        const data: Record<number, number> = {};

        // Initialize last 24 hours with 0
        for (let i = 0; i < 24; i++) {
            const hour = getHours(subHours(now, i));
            data[hour] = 0;
        }

        alerts.forEach(alert => {
            const alertDate = new Date(alert.createdAt);
            if (isAfter(alertDate, subHours(now, 24))) {
                const hour = getHours(alertDate);
                if (data[hour] !== undefined) {
                    data[hour]++;
                }
            }
        });

        // Convert to array for Recharts, sorted chronologically
        const currentHour = getHours(now);
        const chartData = [];
        for (let i = 23; i >= 0; i--) {
            const hour = (currentHour - i + 24) % 24;
            chartData.push({
                time: `${hour}:00`,
                count: data[hour] || 0
            });
        }
        return chartData;
    }, [alerts]);

    // Summary Stats
    const stats = useMemo(() => {
        return alerts.reduce((acc, alert) => {
            acc.total++;
            if (alert.severity === 'critical') acc.critical++;
            else if (alert.severity === 'high') acc.high++;
            else if (alert.severity === 'medium') acc.medium++;
            return acc;
        }, { total: 0, critical: 0, high: 0, medium: 0 });
    }, [alerts]);

    // Temperature Stats
    const temperatureStats = useMemo(() => {
        const temps: number[] = [];
        alerts.forEach((alert: any) => {
            let temp: number | null = null;

            // Extract temperature from rawData
            if (alert.rawData?.Event?.ReeferData?.TAmb !== undefined) {
                temp = alert.rawData.Event.ReeferData.TAmb;
            } else if (alert.rawData?.Event?.DeviceData?.DeviceTemp !== undefined) {
                temp = alert.rawData.Event.DeviceData.DeviceTemp;
            } else if (alert.rawData?.temperature !== undefined) {
                temp = alert.rawData.temperature;
            }

            if (temp !== null && !isNaN(temp)) {
                temps.push(temp);
            }
        });

        if (temps.length === 0) return null;

        const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
        const min = Math.min(...temps);
        const max = Math.max(...temps);

        return {
            current: temps[temps.length - 1],
            avg: parseFloat(avg.toFixed(1)),
            min: parseFloat(min.toFixed(1)),
            max: parseFloat(max.toFixed(1)),
            readings: temps.length
        };
    }, [alerts]);

    const latestAlert = alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertCircle className="h-4 w-4" />;
            case 'high': return <AlertTriangle className="h-4 w-4" />;
            case 'medium': return <Info className="h-4 w-4" />;
            default: return <Info className="h-4 w-4" />;
        }
    };

    return (
        <Card className="border-border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md bg-card">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                            {/* Left: Container Info & Summary */}
                            <div className="flex items-center gap-4">
                                <div className={`w-1 h-12 rounded-full ${stats.critical > 0 ? 'bg-red-500' :
                                        stats.high > 0 ? 'bg-orange-500' :
                                            stats.medium > 0 ? 'bg-yellow-500' : 'bg-blue-500'
                                    }`} />

                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-mono font-semibold text-lg">{container?.containerCode || "Unknown"}</h3>
                                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            {container?.type || "Container"}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {latestAlert ? format(new Date(latestAlert.createdAt), "MMM d, HH:mm") : "No alerts"}
                                        </span>
                                        <span>•</span>
                                        <span className="font-medium text-foreground">{stats.total} Active Alerts</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Severity Counts & Toggle */}
                            <div className="flex items-center gap-6">
                                <div className="flex gap-2">
                                    {stats.critical > 0 && (
                                        <Badge variant="destructive" className="h-6 px-2 gap-1">
                                            {stats.critical} <span className="text-[10px] opacity-80">CRIT</span>
                                        </Badge>
                                    )}
                                    {stats.high > 0 && (
                                        <Badge className="bg-orange-500 hover:bg-orange-600 h-6 px-2 gap-1">
                                            {stats.high} <span className="text-[10px] opacity-80">HIGH</span>
                                        </Badge>
                                    )}
                                    {stats.medium > 0 && (
                                        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black h-6 px-2 gap-1">
                                            {stats.medium} <span className="text-[10px] opacity-80">MED</span>
                                        </Badge>
                                    )}
                                </div>

                                <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 border-t border-border/50 bg-muted/5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">

                            {/* Left Column: Top Issues (2/3 width) */}
                            <div className="lg:col-span-2 space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Unique Issues ({groupedAlerts.length})
                                </h4>

                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                    {groupedAlerts.map((group) => (
                                        <div key={group.id} className="flex items-start justify-between p-3 bg-card border border-border rounded-md hover:border-primary/20 transition-colors group">
                                            <div className="flex gap-3">
                                                <div className={`mt-0.5 p-1.5 rounded-full ${getSeverityColor(group.severity)}`}>
                                                    {getSeverityIcon(group.severity)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{group.title}</span>
                                                        {group.count > 1 && (
                                                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                                                x{group.count}
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            {format(new Date(group.lastSeen), "HH:mm")}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                        {group.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                                                onClick={() => onAcknowledge(group.id)}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Acknowledge</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-xs text-muted-foreground">
                                        Showing all {groupedAlerts.length} unique issues
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-xs"
                                        onClick={() => onViewAll(container.id)}
                                    >
                                        View Full History
                                        <ExternalLink className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* Right Column: Analytics (1/3 width) */}
                            <div className="lg:col-span-1 border-l border-border/50 pl-6">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Activity className="h-3 w-3" />
                                    Alert Activity (24h)
                                </h4>

                                <div className="h-[120px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={analyticsData}>
                                            <defs>
                                                <linearGradient id={`gradient-${container.id}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis
                                                dataKey="time"
                                                hide
                                            />
                                            <YAxis hide />
                                            <RechartsTooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    borderColor: 'hsl(var(--border))',
                                                    borderRadius: '6px',
                                                    fontSize: '12px'
                                                }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="count"
                                                stroke="#ef4444"
                                                fillOpacity={1}
                                                fill={`url(#gradient-${container.id})`}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Freq. Rate</span>
                                        <span className="font-mono font-medium">{(alerts.length / 24).toFixed(1)}/hr</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Peak Hour</span>
                                        <span className="font-mono font-medium">
                                            {analyticsData.reduce((max, curr) => curr.count > max.count ? curr : max, { count: 0, time: '-' }).time}
                                        </span>
                                    </div>
                                </div>

                                {/* Temperature Stats */}
                                {temperatureStats && (
                                    <div className="mt-6 pt-4 border-t border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Thermometer className="h-3 w-3" />
                                            Temperature
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Current</span>
                                                <span className="font-mono font-medium text-orange-600 dark:text-orange-400">
                                                    {temperatureStats.current}°C
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Average</span>
                                                <span className="font-mono font-medium">{temperatureStats.avg}°C</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Range</span>
                                                <span className="font-mono font-medium text-xs">
                                                    {temperatureStats.min}°C - {temperatureStats.max}°C
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground text-center mt-2">
                                                {temperatureStats.readings} readings
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* View Analytics Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-6 gap-2"
                                    onClick={() => setShowAnalytics(true)}
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    View Analytics
                                </Button>
                            </div>

                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Analytics Dialog */}
            <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Container Analytics - {container?.containerCode || "Unknown"}</DialogTitle>
                        <DialogDescription>
                            Detailed performance analytics and insights
                        </DialogDescription>
                    </DialogHeader>

                    <ContainerAnalytics
                        container={container}
                        alerts={allAlerts}
                    />
                </DialogContent>
            </Dialog>
        </Card>
    );
}
