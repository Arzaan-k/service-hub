import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Trophy,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    IndianRupee,
    Star,
    BarChart3
} from "lucide-react";

export function TechnicianPerformance() {
    const [period, setPeriod] = useState("30"); // days

    const { data: analytics, isLoading } = useQuery({
        queryKey: ["/api/technicians/analytics/overview", period],
        queryFn: async () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - parseInt(period));

            const query = period === "all"
                ? ""
                : `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;

            const res = await apiRequest("GET", `/api/technicians/analytics/overview${query}`);
            return await res.json();
        },
    });

    if (isLoading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    // Calculate topStats
    const totalSpend = analytics?.reduce((acc: number, curr: any) => acc + curr.metrics.spend, 0) || 0;
    const avgOnTime = analytics?.length
        ? analytics.reduce((acc: number, curr: any) => acc + curr.metrics.onTimeRate, 0) / analytics.length
        : 0;
    const totalCompleted = analytics?.reduce((acc: number, curr: any) => acc + curr.metrics.pmsDone + curr.metrics.servicesDone, 0) || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Performance Analytics</h2>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                        <SelectItem value="90">Last 3 Months</SelectItem>
                        <SelectItem value="365">Last Year</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-card border-blue-100 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Jobs Done</CardTitle>
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCompleted}</div>
                        <p className="text-xs text-muted-foreground">
                            Across all technicians
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-card border-green-100 dark:border-green-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg On-Time Rate</CardTitle>
                        <Clock className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(avgOnTime)}%</div>
                        <p className="text-xs text-muted-foreground">
                            Target: 90%
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-card border-purple-100 dark:border-purple-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                        <IndianRupee className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalSpend.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Labor + Parts
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-card border-yellow-100 dark:border-yellow-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                        <Trophy className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold truncate">
                            {analytics?.[0]?.technician?.name || "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Most completed jobs
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboard */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Technician Leaderboard
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Rank</TableHead>
                                <TableHead>Technician</TableHead>
                                <TableHead className="text-right">PMs Done</TableHead>
                                <TableHead className="text-right">Services Done</TableHead>
                                <TableHead className="text-center">On-Time Rate</TableHead>
                                <TableHead className="text-right">Spend (₹)</TableHead>
                                <TableHead className="text-center">Client Rating</TableHead>
                                <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analytics?.map((entry: any, index: number) => (
                                <TableRow key={entry.technician.id}>
                                    <TableCell className="font-medium">
                                        {index < 3 ? (
                                            <div className={`
                        flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs
                        ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                    index === 1 ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}
                      `}>
                                                {index + 1}
                                            </div>
                                        ) : (
                                            <span className="pl-2 text-muted-foreground">#{index + 1}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={entry.technician.avatar} />
                                                <AvatarFallback>{entry.technician.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{entry.technician.name}</span>
                                                {entry.metrics.pendingRequests > 0 && (
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" /> {entry.metrics.pendingRequests} pending
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{entry.metrics.pmsDone}</TableCell>
                                    <TableCell className="text-right font-medium">{entry.metrics.servicesDone}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Progress value={entry.metrics.onTimeRate} className="w-16 h-2" />
                                            <span className="text-xs">{Math.round(entry.metrics.onTimeRate)}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {entry.metrics.spend.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center">
                                            <span className="font-bold mr-1">{entry.metrics.clientRating > 0 ? entry.metrics.clientRating.toFixed(1) : '-'}</span>
                                            <Star className={`h-3 w-3 ${entry.metrics.clientRating > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={index < 3 ? "default" : "secondary"}>
                                            {(entry.metrics.pmsDone * 10 + entry.metrics.servicesDone * 15 + (entry.metrics.onTimeRate / 10)).toFixed(0)}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Feedback Highlights (Placeholder for now) */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Feedback Highlights</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">
                        Feedback integration coming soon.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
