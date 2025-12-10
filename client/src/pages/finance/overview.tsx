import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { DollarSign, TrendingUp, Calendar, Wrench, Truck, ArrowRight, Activity, Users, Package } from "lucide-react";
import { Link, useLocation } from "wouter";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function FinanceOverview() {
    const [, setLocation] = useLocation();
    const { data: overview, isLoading } = useQuery({
        queryKey: ["/api/finance/overview"],
    });

    const pieData = overview ? [
        { name: "PM", value: overview.pm_spend },
        { name: "Corrective", value: overview.corrective_spend },
        { name: "Travel", value: overview.travel_spend },
        { name: "Misc", value: overview.misc_spend },
    ].filter(d => d.value > 0) : [];

    return (
        <div className="flex min-h-screen bg-gray-50/50">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header title="Finance Dashboard" />

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Top Actions */}
                    <div className="flex justify-end gap-4">
                        <Button variant="outline" onClick={() => setLocation("/finance/technician-spend")}>
                            View Technician Spend <Users className="ml-2 h-4 w-4" />
                        </Button>
                        <Button onClick={() => setLocation("/finance/container-spend")}>
                            View Per-Container Spend <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : overview ? (
                        <>
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Total Spend (All Time)</p>
                                            <h3 className="text-2xl font-bold">₹{overview.total_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <DollarSign className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Spend This Month</p>
                                            <h3 className="text-2xl font-bold">₹{overview.spend_this_month.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                            <TrendingUp className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">PM Spend</p>
                                            <h3 className="text-2xl font-bold">₹{overview.pm_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Travel Spend</p>
                                            <h3 className="text-2xl font-bold">₹{overview.travel_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Monthly Spend Trend</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={overview.monthly_spend}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="month" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="amount" fill="#3b82f6" name="Spend (₹)" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Spend Distribution</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                        outerRadius={100}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Top Lists */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Package className="h-5 w-5" />
                                            Top 5 Containers by Spend
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {overview.top_containers.map((c: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-muted-foreground font-mono text-sm">#{i + 1}</span>
                                                        <span className="font-medium">{c.code}</span>
                                                    </div>
                                                    <span className="font-bold">₹{c.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            {overview.top_containers.length === 0 && (
                                                <p className="text-muted-foreground text-sm">No data available</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5" />
                                            Top 5 Technicians by Spend
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {overview.top_technicians.map((t: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-muted-foreground font-mono text-sm">#{i + 1}</span>
                                                        <span className="font-medium">{t.name}</span>
                                                    </div>
                                                    <span className="font-bold">₹{t.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            {overview.top_technicians.length === 0 && (
                                                <p className="text-muted-foreground text-sm">No data available</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                        </>
                    ) : (
                        <div className="text-center p-10 text-muted-foreground">
                            Failed to load finance overview.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
