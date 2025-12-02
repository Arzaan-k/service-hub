import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, XCircle, Clock, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Alert {
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    createdAt: string;
    alertCode?: string;
    status?: string;
    resolvedAt?: string;
    acknowledgedAt?: string;
}

interface AlertSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    container: any;
    alerts: Alert[];
    onAcknowledge: (alertId: string) => void;
    onResolve: (alertId: string) => void;
}

export function AlertSidePanel({ isOpen, onClose, container, alerts, onAcknowledge, onResolve }: AlertSidePanelProps) {
    const [filterSeverity, setFilterSeverity] = useState<string>("all");

    const filteredAlerts = useMemo(() => {
        let result = [...alerts];
        if (filterSeverity !== "all") {
            result = result.filter(a => a.severity === filterSeverity);
        }
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [alerts, filterSeverity]);

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case 'medium': return <Info className="h-4 w-4 text-yellow-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
                <SheetHeader className="p-6 border-b border-border">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="font-mono text-xl">{container?.containerCode || "Container Alerts"}</SheetTitle>
                        <Badge variant="outline">{container?.type}</Badge>
                    </div>
                    <SheetDescription>
                        Full alert history and timeline for this container.
                    </SheetDescription>

                    <div className="flex items-center gap-2 mt-4">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                            <SelectTrigger className="w-[150px] h-8 text-xs">
                                <SelectValue placeholder="Filter Severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="relative pl-4 border-l border-border space-y-8">
                        {filteredAlerts.map((alert, index) => (
                            <div key={alert.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background ${alert.severity === 'critical' ? 'bg-red-500' :
                                        alert.severity === 'high' ? 'bg-orange-500' :
                                            alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                    }`} />

                                <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {getSeverityIcon(alert.severity)}
                                            <span className="font-medium text-sm">{alert.title}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {format(new Date(alert.createdAt), "MMM d, HH:mm")}
                                        </span>
                                    </div>

                                    <p className="text-sm text-muted-foreground mb-3">
                                        {alert.description}
                                    </p>

                                    {alert.alertCode && (
                                        <Badge variant="secondary" className="text-[10px] font-mono mb-3">
                                            Code: {alert.alertCode}
                                        </Badge>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {alert.resolvedAt ? (
                                                <span className="text-green-500 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Resolved
                                                </span>
                                            ) : alert.acknowledgedAt ? (
                                                <span className="text-blue-500 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Acknowledged
                                                </span>
                                            ) : (
                                                <span className="text-orange-500 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> Open
                                                </span>
                                            )}
                                        </div>

                                        {!alert.resolvedAt && (
                                            <div className="flex gap-2">
                                                {!alert.acknowledgedAt && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs hover:text-blue-500 hover:bg-blue-500/10"
                                                        onClick={() => onAcknowledge(alert.id)}
                                                    >
                                                        Acknowledge
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs hover:text-green-500 hover:bg-green-500/10"
                                                    onClick={() => onResolve(alert.id)}
                                                >
                                                    Resolve
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredAlerts.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No alerts found matching filters.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
