import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Loader2, Search, DollarSign, TrendingUp, Calendar, Wrench, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpendTransaction {
    id: string;
    date: string;
    type: string;
    reference: string;
    description: string;
    amount: number;
    service_type?: string;
    technician?: string;
}

interface MonthlySpend {
    month: string;
    amount: number;
}

interface SpendData {
    total_spend: number;
    spend_this_month: number;
    labor_spend: number;
    travel_spend: number;
    monthly_spend: MonthlySpend[];
    transactions: SpendTransaction[];
    pm_spend?: number;
    corrective_spend?: number;
}

interface TechnicianSpendItem {
    id: string;
    name: string;
    totalSpend: number;
}

export default function TechnicianSpend() {
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch technicians for search
    const { data: technicians } = useQuery({
        queryKey: ["/api/technicians"],
        select: (data: any[]) => data.map(t => ({ id: t.id, name: t.name })),
    });

    // Filter technicians based on search
    const filteredTechnicians = technicians?.filter((t: any) =>
        t && (t.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
    ).slice(0, 10) || [];

    // Fetch spend data for selected technician
    const { data: spendData, isLoading } = useQuery<SpendData>({
        queryKey: ["/api/finance/technician-spend", selectedTechnicianId],
        enabled: !!selectedTechnicianId,
    });

    return (
        <div className="flex min-h-screen bg-gray-50/50">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header title="Finance: Technician Spend" />

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Search Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Technician</CardTitle>
                            <CardDescription>Search for a technician to view financial details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Technician Name..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredTechnicians.map((t: any) => (
                                            <div
                                                key={t.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                                                onClick={() => {
                                                    setSelectedTechnicianId(t.id);
                                                    setSearchTerm(t.name);
                                                }}
                                            >
                                                <span className="font-medium">{t.name}</span>
                                            </div>
                                        ))}
                                        {filteredTechnicians.length === 0 && (
                                            <div className="p-2 text-gray-500 text-center">No technicians found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {selectedTechnicianId && isLoading && (
                        <div className="flex justify-center p-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}

                    {!selectedTechnicianId && (
                        <TechnicianSpendList onSelect={(id, name) => {
                            setSelectedTechnicianId(id);
                            setSearchTerm(name);
                        }} />
                    )}

                    {selectedTechnicianId && spendData && (
                        <>
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Total Spend</p>
                                            <h3 className="text-2xl font-bold">₹{spendData.total_spend.toLocaleString()}</h3>
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
                                            <h3 className="text-2xl font-bold">₹{spendData.spend_this_month.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                            <TrendingUp className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Labor/Service</p>
                                            <h3 className="text-2xl font-bold">₹{spendData.labor_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                            <Wrench className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Travel Spend</p>
                                            <h3 className="text-2xl font-bold">₹{spendData.travel_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Monthly Spend Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Monthly Spend Overview</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={spendData.monthly_spend}>
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

                            {/* Detailed Breakdown */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Detailed Transaction History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Reference</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {spendData.transactions.map((t) => (
                                                <TableRow key={t.id}>
                                                    <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-full text-xs font-medium",
                                                            t.type === "Service Request" ? "bg-purple-100 text-purple-700" :
                                                                t.type === "Trip" ? "bg-blue-100 text-blue-700" :
                                                                    "bg-gray-100 text-gray-700"
                                                        )}>
                                                            {t.type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{t.reference}</TableCell>
                                                    <TableCell>{t.description}</TableCell>
                                                    <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                            {spendData.transactions.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                        No transactions found.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

function TechnicianSpendList({ onSelect }: { onSelect: (id: string, name: string) => void }) {
    const { data: technicianSpends, isLoading } = useQuery<TechnicianSpendItem[]>({
        queryKey: ["/api/finance/technician-spend"],
    });

    if (isLoading) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Technicians by Spend</CardTitle>
                <CardDescription>
                    List of technicians and their total associated costs (Service Requests, Travel, Expenses).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Technician Name</TableHead>
                            <TableHead className="text-right">Total Spend</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {technicianSpends?.map((t) => (
                            <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(t.id, t.name)}>
                                <TableCell className="font-medium">{t.name}</TableCell>
                                <TableCell className="text-right font-bold">₹{t.totalSpend.toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(t.id, t.name);
                                        }}
                                    >
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!technicianSpends || technicianSpends.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                    No technician spend data found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
