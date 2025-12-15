import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Plus, Search, DollarSign, TrendingUp, Calendar, Wrench, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ContainerSpend() {
    const [selectedContainerId, setSelectedContainerId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch containers for search
    const { data: containers } = useQuery({
        queryKey: ["/api/containers"],
        select: (data: any[]) => data.map(c => ({ id: c.id, code: c.containerCode, client: c.customer?.companyName })),
    });

    // Filter containers based on search
    const filteredContainers = containers?.filter((c: any) =>
        (c.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.client || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10) || [];

    // Fetch spend data for selected container
    const { data: spendData, isLoading } = useQuery({
        queryKey: ["/api/finance/container-spend", selectedContainerId],
        enabled: !!selectedContainerId,
    });

    // Add Expense Mutation
    const addExpenseMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/finance/container-spend/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to add expense");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/finance/container-spend", selectedContainerId] });
            queryClient.invalidateQueries({ queryKey: ["/api/finance/overview"] });
            queryClient.invalidateQueries({ queryKey: ["/api/finance/reefer-spend"] });
            queryClient.invalidateQueries({ queryKey: ["/api/finance/technician-spend"] });
            setIsAddExpenseOpen(false);
            toast({
                title: "Expense Added",
                description: "The expense has been successfully recorded.",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to add expense. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data = {
            containerId: selectedContainerId,
            expenseType: formData.get("expenseType"),
            description: formData.get("description"),
            amount: Number(formData.get("amount")),
            date: formData.get("date"),
            // technicianId: formData.get("technicianId") || null, // Optional
        };
        addExpenseMutation.mutate(data);
    };

    return (
        <div className="flex min-h-screen bg-gray-50/50">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header title="Finance: Per-Container Spend" />

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Search Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Container</CardTitle>
                            <CardDescription>Search for a container to view financial details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Container ID or Client..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredContainers.map((c: any) => (
                                            <div
                                                key={c.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                                                onClick={() => {
                                                    setSelectedContainerId(c.id);
                                                    setSearchTerm(c.code);
                                                }}
                                            >
                                                <span className="font-medium">{c.code}</span>
                                                <span className="text-sm text-gray-500">{c.client}</span>
                                            </div>
                                        ))}
                                        {filteredContainers.length === 0 && (
                                            <div className="p-2 text-gray-500 text-center">No containers found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {selectedContainerId && isLoading && (
                        <div className="flex justify-center p-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}

                    {!selectedContainerId && (
                        <ReeferSpendList onSelect={(id, code) => {
                            setSelectedContainerId(id);
                            setSearchTerm(code || "");
                        }} />
                    )}

                    {selectedContainerId && spendData && (
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
                                            <p className="text-sm font-medium text-muted-foreground">PM Spend</p>
                                            <h3 className="text-2xl font-bold">₹{spendData.pm_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Corrective Spend</p>
                                            <h3 className="text-2xl font-bold">₹{spendData.corrective_spend.toLocaleString()}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                            <Wrench className="h-5 w-5" />
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

                            {/* Detailed Breakdown & Add Expense */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Detailed Spend Breakdown</CardTitle>
                                    <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                                        <DialogTrigger asChild>
                                            <Button>
                                                <Plus className="mr-2 h-4 w-4" /> Add Expense
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Add Miscellaneous Expense</DialogTitle>
                                                <DialogDescription>
                                                    Record an extra expense for this container.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <form onSubmit={handleAddExpense} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="expenseType">Expense Type</Label>
                                                    <Select name="expenseType" required>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Travel">Travel</SelectItem>
                                                            <SelectItem value="Material">Material</SelectItem>
                                                            <SelectItem value="Misc">Misc</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="description">Description</Label>
                                                    <Input id="description" name="description" required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="amount">Amount (₹)</Label>
                                                    <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="date">Date</Label>
                                                    <Input id="date" name="date" type="date" required />
                                                </div>
                                                <DialogFooter>
                                                    <Button type="submit" disabled={addExpenseMutation.isPending}>
                                                        {addExpenseMutation.isPending ? "Saving..." : "Save Expense"}
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Service Type</TableHead>
                                                <TableHead>Technician</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {spendData.transactions.map((t: any) => (
                                                <TableRow key={t.id}>
                                                    <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-full text-xs font-medium",
                                                            t.service_type === "PM" ? "bg-purple-100 text-purple-700" :
                                                                t.service_type === "Corrective" ? "bg-orange-100 text-orange-700" :
                                                                    t.service_type === "Travel" ? "bg-blue-100 text-blue-700" :
                                                                        "bg-gray-100 text-gray-700"
                                                        )}>
                                                            {t.service_type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{t.technician}</TableCell>
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

function ReeferSpendList({ onSelect }: { onSelect: (id: string, code: string) => void }) {
    const { data: reeferSpends, isLoading } = useQuery({
        queryKey: ["/api/finance/reefer-spend"],
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
                <CardTitle>Active Reefer Containers with Spend</CardTitle>
                <CardDescription>
                    List of reefer containers where services have been provided and costs incurred.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Container ID</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Total Spend</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reeferSpends?.map((c: any) => (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(c.id, c.containerCode)}>
                                <TableCell className="font-medium">{c.containerCode}</TableCell>
                                <TableCell>{c.client}</TableCell>
                                <TableCell>{c.type}</TableCell>
                                <TableCell className="text-right font-bold">₹{c.totalSpend.toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(c.id, c.containerCode);
                                        }}
                                    >
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!reeferSpends || reeferSpends.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    No reefer spend data found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
