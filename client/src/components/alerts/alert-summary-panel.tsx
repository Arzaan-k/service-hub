import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Activity, Box } from "lucide-react";

interface AlertSummaryPanelProps {
    totalAlerts: number;
    criticalCount: number;
    highCount: number;
    topContainer: { code: string; count: number } | null;
}

export function AlertSummaryPanel({ totalAlerts, criticalCount, highCount, topContainer }: AlertSummaryPanelProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Active Alerts</CardTitle>
                    <Activity className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalAlerts}</div>
                    <p className="text-xs text-muted-foreground">Across all containers</p>
                </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Critical Issues</CardTitle>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
                    <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-500">{highCount}</div>
                    <p className="text-xs text-muted-foreground">Monitor closely</p>
                </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Top Affected</CardTitle>
                    <Box className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold truncate">{topContainer ? topContainer.code : "N/A"}</div>
                    <p className="text-xs text-muted-foreground">
                        {topContainer ? `${topContainer.count} active alerts` : "No active alerts"}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
