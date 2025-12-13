import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  ArrowUpDown,
  Calendar,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
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
  LineChart,
  Line
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClientAnalytics {
  client_id: string;
  client_name: string;
  container_count: number;
  total_pms: number;
  completed: number;
  pending: number;
  overdue: number;
  never: number;
  compliance_percentage: number;
  last_activity: string | null;
}

interface TechnicianAnalytics {
  technician_id: string;
  technician_name: string;
  total_assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  travel_cost: number;
  pm_completion_rate: number;
  last_completed_date: string | null;
}

type SortOption = 'name' | 'compliance' | 'overdue' | 'pms' | 'completion' | 'assigned' | 'cost';
type SortDirection = 'asc' | 'desc';

// Helper component for Client Details
const ClientDetailView = ({ client }: { client: ClientAnalytics }) => {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: [`/api/service-requests?customerId=${client.client_id}`],
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{client.compliance_percentage}%</div>
            <p className="text-xs text-muted-foreground">Compliance Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{client.total_pms}</div>
            <p className="text-xs text-muted-foreground">Total PMs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{client.overdue}</div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{client.container_count}</div>
            <p className="text-xs text-muted-foreground">Containers</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Recent Service Requests</h3>
        <ScrollArea className="h-[300px] rounded-md border p-2">
          {isLoading ? (
            <div className="text-center py-4">Loading history...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.requestNumber}</TableCell>
                    <TableCell>
                      <Badge variant={req.status === 'completed' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.priority}</TableCell>
                    <TableCell className="text-right">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

// Helper component for Technician Details
const TechnicianDetailView = ({ technician }: { technician: TechnicianAnalytics }) => {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: [`/api/service-requests?technicianId=${technician.technician_id}`],
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{technician.pm_completion_rate}%</div>
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{technician.total_assigned}</div>
            <p className="text-xs text-muted-foreground">Total Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{technician.completed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">₹{technician.travel_cost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Travel Cost</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Assigned Tasks</h3>
        <ScrollArea className="h-[300px] rounded-md border p-2">
          {isLoading ? (
            <div className="text-center py-4">Loading tasks...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.requestNumber}</TableCell>
                    <TableCell>
                      <Badge variant={req.status === 'completed' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.priority}</TableCell>
                    <TableCell className="text-right">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<string>('90');
  const [clientSearch, setClientSearch] = useState('');
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [clientSort, setClientSort] = useState<{ option: SortOption; direction: SortDirection }>({
    option: 'name',
    direction: 'asc'
  });
  const [technicianSort, setTechnicianSort] = useState<{ option: SortOption; direction: SortDirection }>({
    option: 'name',
    direction: 'asc'
  });

  const [selectedClient, setSelectedClient] = useState<ClientAnalytics | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianAnalytics | null>(null);

  // Fetch client analytics
  const { data: clientAnalytics = [], isLoading: clientLoading } = useQuery<ClientAnalytics[]>({
    queryKey: [`/api/analytics/clients?range=${timeRange}`],
  });

  // Fetch technician analytics
  const { data: technicianAnalytics = [], isLoading: technicianLoading } = useQuery<TechnicianAnalytics[]>({
    queryKey: [`/api/analytics/technicians?range=${timeRange}`],
  });

  // Filter and sort client data
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clientAnalytics.filter(client =>
      client.client_name.toLowerCase().includes(clientSearch.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (clientSort.option) {
        case 'name':
          aValue = a.client_name.toLowerCase();
          bValue = b.client_name.toLowerCase();
          break;
        case 'compliance':
          aValue = a.compliance_percentage;
          bValue = b.compliance_percentage;
          break;
        case 'overdue':
          aValue = a.overdue;
          bValue = b.overdue;
          break;
        case 'pms':
          aValue = a.total_pms;
          bValue = b.total_pms;
          break;
        default:
          aValue = a.client_name.toLowerCase();
          bValue = b.client_name.toLowerCase();
      }

      if (clientSort.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [clientAnalytics, clientSearch, clientSort]);

  // Filter and sort technician data
  const filteredAndSortedTechnicians = useMemo(() => {
    let filtered = technicianAnalytics.filter(tech =>
      tech.technician_name.toLowerCase().includes(technicianSearch.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (technicianSort.option) {
        case 'name':
          aValue = a.technician_name.toLowerCase();
          bValue = b.technician_name.toLowerCase();
          break;
        case 'completion':
          aValue = a.pm_completion_rate;
          bValue = b.pm_completion_rate;
          break;
        case 'assigned':
          aValue = a.total_assigned;
          bValue = b.total_assigned;
          break;
        case 'cost':
          aValue = a.travel_cost;
          bValue = b.travel_cost;
          break;
        default:
          aValue = a.technician_name.toLowerCase();
          bValue = b.technician_name.toLowerCase();
      }

      if (technicianSort.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [technicianAnalytics, technicianSearch, technicianSort]);

  const toggleClientSort = (option: SortOption) => {
    if (clientSort.option === option) {
      setClientSort(prev => ({
        ...prev,
        direction: prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      setClientSort({ option, direction: 'asc' });
    }
  };

  const toggleTechnicianSort = (option: SortOption) => {
    if (technicianSort.option === option) {
      setTechnicianSort(prev => ({
        ...prev,
        direction: prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      setTechnicianSort({ option, direction: 'asc' });
    }
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getComplianceColor = getCompletionColor;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Prepare chart data
  const clientComplianceData = useMemo(() => {
    if (!clientAnalytics) return [];
    return clientAnalytics
      .sort((a, b) => b.compliance_percentage - a.compliance_percentage)
      .slice(0, 10)
      .map(c => ({
        name: c.client_name.length > 15 ? c.client_name.substring(0, 15) + '...' : c.client_name,
        compliance: c.compliance_percentage,
        pms: c.total_pms
      }));
  }, [clientAnalytics]);

  const technicianPerformanceData = useMemo(() => {
    if (!technicianAnalytics) return [];
    return technicianAnalytics
      .sort((a, b) => b.pm_completion_rate - a.pm_completion_rate)
      .map(t => ({
        name: t.technician_name.split(' ')[0], // First name only for compactness
        completed: t.completed,
        pending: t.pending,
        rate: t.pm_completion_rate
      }));
  }, [technicianAnalytics]);

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Client & Technician Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Select Summary Range:</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="120">Last 120 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview & Charts</TabsTrigger>
          <TabsTrigger value="clients">Client Details</TabsTrigger>
          <TabsTrigger value="technicians">Technician Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Client Compliance</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientComplianceData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="compliance" fill="#10b981" name="Compliance %" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Technician Performance</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={technicianPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                    <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Client PM Performance
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-8 w-48 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium">Sort:</span>
                <div className="flex gap-1">
                  {['name', 'compliance', 'overdue', 'pms'].map((opt) => (
                    <Button
                      key={opt}
                      variant={clientSort.option === opt ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => toggleClientSort(opt as any)}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      {clientSort.option === opt && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {clientLoading ? (
                <div className="text-center py-4">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredAndSortedClients.map((client) => (
                    <Card
                      key={client.client_id}
                      className="hover:shadow-md transition-all border-l-4 cursor-pointer active:scale-95"
                      style={{ borderLeftColor: client.compliance_percentage >= 80 ? '#10b981' : client.compliance_percentage >= 60 ? '#f59e0b' : '#ef4444' }}
                      onClick={() => setSelectedClient(client)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-sm truncate flex-1" title={client.client_name}>{client.client_name}</h3>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ml-2 ${getComplianceColor(client.compliance_percentage)}`}>
                            {client.compliance_percentage}%
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="text-muted-foreground">PMs: <span className="text-foreground font-medium">{client.total_pms}</span></div>
                              <div className="text-muted-foreground">Cont: <span className="text-foreground font-medium">{client.container_count}</span></div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t">
                              <div className="flex gap-2">
                                <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="h-3 w-3" /> {client.completed}</span>
                                <span className="text-yellow-600 flex items-center gap-0.5"><Clock className="h-3 w-3" /> {client.pending}</span>
                                <span className="text-red-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {client.overdue}</span>
                              </div>
                            </div>
                          </div>

                          {/* Mini Pie Chart */}
                          <div className="h-[60px] w-[60px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Completed', value: client.completed, fill: '#10b981' },
                                    { name: 'Pending', value: client.pending, fill: '#f59e0b' },
                                    { name: 'Overdue', value: client.overdue, fill: '#ef4444' }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={15}
                                  outerRadius={25}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  <Cell key="cell-0" fill="#10b981" />
                                  <Cell key="cell-1" fill="#f59e0b" />
                                  <Cell key="cell-2" fill="#ef4444" />
                                </Pie>
                                <Tooltip
                                  contentStyle={{ fontSize: '10px', padding: '2px 4px' }}
                                  itemStyle={{ padding: 0 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Technician Performance
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={technicianSearch}
                      onChange={(e) => setTechnicianSearch(e.target.value)}
                      className="pl-8 w-48 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium">Sort:</span>
                <div className="flex gap-1">
                  {['name', 'completion', 'assigned', 'cost'].map((opt) => (
                    <Button
                      key={opt}
                      variant={technicianSort.option === opt ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => toggleTechnicianSort(opt as any)}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      {technicianSort.option === opt && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {technicianLoading ? (
                <div className="text-center py-4">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredAndSortedTechnicians.map((tech) => (
                    <Card
                      key={tech.technician_id}
                      className="hover:shadow-md transition-all cursor-pointer active:scale-95"
                      onClick={() => setSelectedTechnician(tech)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-sm truncate flex-1">{tech.technician_name}</h3>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ml-2 ${getCompletionColor(tech.pm_completion_rate)}`}>
                            {tech.pm_completion_rate}%
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="text-muted-foreground">Assigned: <span className="text-foreground font-medium">{tech.total_assigned}</span></div>
                              <div className="text-muted-foreground">Cost: <span className="text-foreground font-medium">₹{tech.travel_cost.toLocaleString()}</span></div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t">
                              <div className="flex gap-2">
                                <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="h-3 w-3" /> {tech.completed}</span>
                                <span className="text-yellow-600 flex items-center gap-0.5"><Clock className="h-3 w-3" /> {tech.pending}</span>
                                <span className="text-red-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {tech.overdue}</span>
                              </div>
                            </div>
                          </div>

                          {/* Mini Pie Chart */}
                          <div className="h-[60px] w-[60px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Completed', value: tech.completed, fill: '#10b981' },
                                    { name: 'Pending', value: tech.pending, fill: '#f59e0b' },
                                    { name: 'Overdue', value: tech.overdue, fill: '#ef4444' }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={15}
                                  outerRadius={25}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  <Cell key="cell-0" fill="#10b981" />
                                  <Cell key="cell-1" fill="#f59e0b" />
                                  <Cell key="cell-2" fill="#ef4444" />
                                </Pie>
                                <Tooltip
                                  contentStyle={{ fontSize: '10px', padding: '2px 4px' }}
                                  itemStyle={{ padding: 0 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Client Detail Modal */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedClient?.client_name}</DialogTitle>
            <DialogDescription>
              Detailed performance analytics and history
            </DialogDescription>
          </DialogHeader>
          {selectedClient && <ClientDetailView client={selectedClient} />}
        </DialogContent>
      </Dialog>

      {/* Technician Detail Modal */}
      <Dialog open={!!selectedTechnician} onOpenChange={(open) => !open && setSelectedTechnician(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTechnician?.technician_name}</DialogTitle>
            <DialogDescription>
              Technician performance and assigned tasks
            </DialogDescription>
          </DialogHeader>
          {selectedTechnician && <TechnicianDetailView technician={selectedTechnician} />}
        </DialogContent>
      </Dialog>
    </div >
  );
}
