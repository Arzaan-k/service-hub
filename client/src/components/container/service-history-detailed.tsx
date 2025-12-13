import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Wrench,
    AlertTriangle,
    CheckCircle,
    Clock,
    DollarSign,
    User,
    Calendar,
    Activity,
    FileText,
    TrendingUp,
    AlertCircle
} from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface ServiceHistoryDetailedProps {
    containerId: string;
}

export default function ServiceHistoryDetailed({ containerId }: ServiceHistoryDetailedProps) {
    const { data: history, isLoading, error } = useQuery({
        queryKey: [`/api/containers/${containerId}/service-history/detailed`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/containers/${containerId}/service-history/detailed`);
            return response.json();
        },
        enabled: !!containerId,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !history) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">Failed to load service history</h3>
                <p className="text-muted-foreground">Please try again later.</p>
            </div>
        );
    }

    const { timeline, summary, recurringIssues, technicianStats } = history;

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'completed' || s === 'ok') return "bg-green-500/20 text-green-200 border-green-400/30";
        if (s === 'in_progress') return "bg-blue-500/20 text-blue-200 border-blue-400/30";
        if (s === 'pending') return "bg-yellow-500/20 text-yellow-200 border-yellow-400/30";
        if (s === 'cancelled') return "bg-red-500/20 text-red-200 border-red-400/30";
        return "bg-gray-500/20 text-gray-200 border-gray-400/30";
    };

    const getTypeIcon = (type: string) => {
        const t = type?.toLowerCase() || '';
        if (t.includes('pm') || t.includes('preventive')) return <CheckCircle className="h-4 w-4 text-green-400" />;
        if (t.includes('breakdown') || t.includes('corrective')) return <AlertTriangle className="h-4 w-4 text-red-400" />;
        return <Wrench className="h-4 w-4 text-blue-400" />;
    };

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Services</CardTitle>
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalServices}</div>
                        <p className="text-xs text-muted-foreground">
                            {summary.pms} PMs, {summary.breakdowns} Breakdowns
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lifetime Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{summary.lifetimeCost.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total maintenance spend</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recurring Issues</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.repeatErrors}</div>
                        <p className="text-xs text-muted-foreground">Repeated error codes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Technicians</CardTitle>
                        <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.techniciansCount}</div>
                        <p className="text-xs text-muted-foreground">Unique technicians</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Service Timeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative border-l border-muted ml-4 space-y-8 pb-4">
                                {timeline.map((event: any, index: number) => (
                                    <div key={`${event.source}-${event.id}-${index}`} className="relative pl-6">
                                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-background border-2 border-primary" />
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-muted-foreground">
                                                        {event.date ? new Date(event.date).toLocaleDateString() : 'Date Unknown'}
                                                    </span>
                                                    <Badge variant="outline" className="flex items-center gap-1">
                                                        {getTypeIcon(event.type)}
                                                        {event.type || 'Service'}
                                                    </Badge>
                                                    {event.requestNumber && (
                                                        <Badge variant="secondary" className="font-mono text-xs">
                                                            {event.requestNumber}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge className={getStatusColor(event.status)}>
                                                    {event.status || 'Unknown'}
                                                </Badge>
                                            </div>

                                            <div className="bg-muted/30 p-4 rounded-lg border">
                                                <h4 className="font-medium mb-2">{event.issueDescription || 'No description available'}</h4>

                                                {event.resolutionNotes && (
                                                    <div className="mb-3 text-sm text-muted-foreground bg-background/50 p-2 rounded">
                                                        <span className="font-medium text-foreground">Resolution: </span>
                                                        {event.resolutionNotes}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                    {event.technicianName && (
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-3 w-3 text-muted-foreground" />
                                                            <span>{event.technicianName}</span>
                                                        </div>
                                                    )}
                                                    {event.cost && (
                                                        <div className="flex items-center gap-2">
                                                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                            <span>₹{Number(event.cost).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {event.serviceDuration && (
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                                            <span>{event.serviceDuration} mins</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {event.usedParts && event.usedParts.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-border/50">
                                                        <p className="text-xs font-medium text-muted-foreground mb-2">Parts Used:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {event.usedParts.map((part: any, i: number) => (
                                                                <Badge key={i} variant="outline" className="text-xs">
                                                                    {part.name} (x{part.quantity})
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {timeline.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No service history found.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    {/* Recurring Issues */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <TrendingUp className="h-4 w-4" />
                                Recurring Issues
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {recurringIssues.length > 0 ? (
                                recurringIssues.map((issue: any, i: number) => (
                                    <div key={i} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg border">
                                        <div>
                                            <div className="font-medium text-sm">{issue.code}</div>
                                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                {issue.description}
                                            </div>
                                        </div>
                                        <Badge variant="destructive" className="ml-2">
                                            {issue.count}x
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No recurring issues detected.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Technician Performance */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <User className="h-4 w-4" />
                                Technician History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {technicianStats.map((tech: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                                            {tech.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium">{tech.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Last visit: {tech.lastVisit ? new Date(tech.lastVisit).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">{tech.services} Visits</div>
                                        <div className="text-xs text-muted-foreground">{tech.completed} Completed</div>
                                    </div>
                                </div>
                            ))}
                            {technicianStats.length === 0 && (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No technician data available.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
