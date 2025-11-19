/**
 * SERVICE HISTORY OVERVIEW PAGE
 *
 * Smart, non-overwhelming interface to explore 1,645 historical service records
 * Uses progressive disclosure: summary → list → details
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Calendar,
  Container,
  Users,
  TrendingUp,
  FileText,
  Filter,
  X,
  ChevronRight,
  BarChart3,
  History,
  Package
} from "lucide-react";
import { format } from "date-fns";
import ServiceHistoryDetailed from "@/components/ServiceHistoryDetailed";
import { getAuthToken } from "@/lib/auth";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ServiceHistoryOverview() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedView, setSelectedView] = useState<"cards" | "table">("cards");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch summary statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/service-history/stats/summary'],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch('/api/service-history/stats/summary', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  // Fetch service history with search/filter
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['/api/service-history', searchTerm, filterType],
    queryFn: async () => {
      const token = getAuthToken();
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType !== 'all') params.append('type', filterType);

      const res = await fetch(`/api/service-history?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    }
  });

  const openDetails = (history: any) => {
    setSelectedHistory(history);
    setShowDetailsDialog(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Hero Section with Key Stats */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-8 w-8" />
          Service History Archive
        </h1>
        <p className="text-muted-foreground">
          Explore comprehensive service records to understand patterns, performance, and improve future operations
        </p>
      </div>

      {/* Quick Stats Dashboard */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Services"
          value={stats?.total_services?.toLocaleString() || "0"}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          description="Historical records"
          trend="+2 years of data"
        />
        <StatsCard
          title="Containers Serviced"
          value={stats?.unique_containers?.toLocaleString() || "0"}
          icon={<Container className="h-5 w-5 text-green-600" />}
          description="Unique assets"
          trend="Across 35 cities"
        />
        <StatsCard
          title="Technicians"
          value={stats?.unique_technicians?.toLocaleString() || "0"}
          icon={<Users className="h-5 w-5 text-purple-600" />}
          description="Service providers"
          trend="Active team members"
        />
        <StatsCard
          title="Avg Response"
          value={`${stats?.avg_response_hours || 0}h`}
          icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
          description="From complaint to service"
          trend="Performance metric"
        />
      </div>

      {/* Insights Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <InsightCard
          title="FOC Services"
          value={`${stats?.foc_services || 0}`}
          percentage={stats?.total_services ? Math.round((stats.foc_services / stats.total_services) * 100) : 0}
          color="blue"
          description="Free of cost services"
        />
        <InsightCard
          title="Paid Services"
          value={`${stats?.paid_services || 0}`}
          percentage={stats?.total_services ? Math.round((stats.paid_services / stats.total_services) * 100) : 0}
          color="green"
          description="Revenue generating"
        />
        <InsightCard
          title="Parts Required"
          value={`${stats?.services_with_parts || 0}`}
          percentage={stats?.total_services ? Math.round((stats.services_with_parts / stats.total_services) * 100) : 0}
          color="purple"
          description="Services needing parts"
        />
      </div>

      {/* Search and Filter Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Explore Service Records</CardTitle>
          <CardDescription>
            Search by job order, container number, client name, or technician
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search job orders, containers, clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="foc">FOC Only</SelectItem>
                <SelectItem value="paid">Paid Only</SelectItem>
                <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                <SelectItem value="reactive">Reactive Services</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {/* View Toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={selectedView === "cards" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedView("cards")}
              >
                Cards
              </Button>
              <Button
                variant={selectedView === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedView("table")}
              >
                Table
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Views */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent">Recent Services</TabsTrigger>
          <TabsTrigger value="containers">By Container</TabsTrigger>
          <TabsTrigger value="technicians">By Technician</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Recent Services Tab */}
        <TabsContent value="recent" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading service history...</p>
            </div>
          ) : (
            <ServiceHistoryList
              data={historyData?.data || []}
              viewType={selectedView}
              onViewDetails={openDetails}
            />
          )}
        </TabsContent>

        {/* By Container Tab */}
        <TabsContent value="containers">
          <ContainerHistoryView onViewDetails={openDetails} />
        </TabsContent>

        {/* By Technician Tab */}
        <TabsContent value="technicians">
          <TechnicianHistoryView onViewDetails={openDetails} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AnalyticsView />
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Service History</DialogTitle>
            <DialogDescription>
              Detailed view of all service stages, inspection, and documentation
            </DialogDescription>
          </DialogHeader>
          {selectedHistory && <ServiceHistoryDetailed serviceHistory={selectedHistory} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatsCard({
  title,
  value,
  icon,
  description,
  trend
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  trend: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        <p className="text-xs text-blue-600 mt-1">{trend}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  title,
  value,
  percentage,
  color,
  description
}: {
  title: string;
  value: string;
  percentage: number;
  color: "blue" | "green" | "purple";
  description: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700"
  };

  return (
    <Card className={`border-2 ${colorClasses[color]}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary">{percentage}%</Badge>
        </div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <p className="text-xs opacity-80">{description}</p>
      </CardContent>
    </Card>
  );
}

function ServiceHistoryList({
  data,
  viewType,
  onViewDetails
}: {
  data: any[];
  viewType: "cards" | "table";
  onViewDetails: (history: any) => void;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No service records found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </CardContent>
      </Card>
    );
  }

  if (viewType === "table") {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Job Order</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Container</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Technician</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.slice(0, 50).map((record) => (
                  <tr key={record.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">{record.jobOrderNumber}</td>
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(record.complaintAttendedDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs">{record.containerNumber}</td>
                    <td className="px-4 py-3 text-sm">{record.clientName}</td>
                    <td className="px-4 py-3 text-sm">{record.technicianName || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={record.jobType === 'FOC' ? 'secondary' : 'default'} className="text-xs">
                        {record.jobType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(record)}
                      >
                        View <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 50 && (
            <div className="p-4 border-t text-center text-sm text-muted-foreground">
              Showing first 50 of {data.length} records. Use search to narrow results.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Card view
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.slice(0, 30).map((record) => (
        <ServiceHistoryCard
          key={record.id}
          data={record}
          onViewDetails={() => onViewDetails(record)}
        />
      ))}
      {data.length > 30 && (
        <Card className="flex items-center justify-center p-6 border-dashed">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              +{data.length - 30} more records
            </p>
            <p className="text-xs text-muted-foreground">
              Use search or switch to table view
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function ServiceHistoryCard({
  data,
  onViewDetails
}: {
  data: any;
  onViewDetails: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onViewDetails}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{data.jobOrderNumber}</CardTitle>
            <CardDescription className="mt-1">
              {format(new Date(data.complaintAttendedDate), 'MMM dd, yyyy')}
            </CardDescription>
          </div>
          <Badge variant={data.jobType === 'FOC' ? 'secondary' : 'default'}>
            {data.jobType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs">{data.containerNumber}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{data.clientName}</span>
        </div>
        {data.technicianName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Tech:</span>
            <span className="font-medium">{data.technicianName}</span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
        >
          View Full Details
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ContainerHistoryView({ onViewDetails }: { onViewDetails: (history: any) => void }) {
  const { data: containers } = useQuery({
    queryKey: ['/api/service-history/stats/containers'],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch('/api/service-history/stats/containers', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch container stats');
      return res.json();
    }
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {containers?.slice(0, 12).map((container: any) => (
        <Card key={container.container_number} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base font-mono">{container.container_number}</CardTitle>
            <CardDescription>
              {container.service_count} service{container.service_count !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Last Service:</span>
              <p className="font-medium">
                {format(new Date(container.last_service), 'MMM dd, yyyy')}
              </p>
            </div>
            {container.common_issues && container.common_issues.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Common Issue:</span>
                <p className="font-medium text-xs truncate">
                  {container.common_issues[0]}
                </p>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                // Fetch and display first service for this container
                const token = getAuthToken();
                fetch(`/api/service-history/container/${container.container_number}`, {
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': token || ''
                  }
                })
                  .then(res => res.json())
                  .then(data => data[0] && onViewDetails(data[0]));
              }}
            >
              View History
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TechnicianHistoryView({ onViewDetails }: { onViewDetails: (history: any) => void }) {
  const { data: technicians } = useQuery({
    queryKey: ['/api/service-history/stats/technicians'],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch('/api/service-history/stats/technicians', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch technician stats');
      return res.json();
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Technicians ranked by total services completed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {technicians?.slice(0, 10).map((tech: any, index: number) => (
              <div key={tech.technician_name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-50 text-blue-700'
                  } font-bold text-sm`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{tech.technician_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tech.unique_containers_serviced} containers • {tech.unique_clients_served} clients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{tech.total_jobs}</p>
                  <p className="text-xs text-muted-foreground">services</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Service Type Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Preventive Maintenance</span>
                <span className="text-sm font-medium">44%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '44%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Reactive Services</span>
                <span className="text-sm font-medium">40%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-600 h-2 rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Installation</span>
                <span className="text-sm font-medium">6%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '6%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Breakdown</span>
                <span className="text-sm font-medium">5%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-600 h-2 rounded-full" style={{ width: '5%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Health Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="font-semibold text-green-900">Excellent</p>
                <p className="text-xs text-green-700">Coil cleanliness</p>
              </div>
              <p className="text-2xl font-bold text-green-600">98.8%</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <p className="font-semibold text-yellow-900">Monitor</p>
                <p className="text-xs text-yellow-700">Need gas top-up</p>
              </div>
              <p className="text-2xl font-bold text-yellow-600">5.3%</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <p className="font-semibold text-orange-900">Action Needed</p>
                <p className="text-xs text-orange-700">Display replacement</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">4.4%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Top Issues (Historical)</CardTitle>
          <CardDescription>Most common problems encountered in service history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <p className="text-3xl font-bold text-red-600">75</p>
              <p className="text-sm font-medium mt-1">Temperature not maintaining</p>
              <p className="text-xs text-muted-foreground mt-1">#1 issue</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-3xl font-bold text-orange-600">16</p>
              <p className="text-sm font-medium mt-1">Compressor noise</p>
              <p className="text-xs text-muted-foreground mt-1">#2 issue</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-3xl font-bold text-yellow-600">15</p>
              <p className="text-sm font-medium mt-1">Display not visible</p>
              <p className="text-xs text-muted-foreground mt-1">#3 issue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
