import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Filter,
  Download,
  Calendar as CalendarIcon,
  Wrench,
  ExternalLink,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function ServiceHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [billingTypeFilter, setBillingTypeFilter] = useState("all");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const { data: serviceRequests, isLoading, refetch } = useQuery({
    queryKey: ["/api/service-history"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/service-history");
      return response.json();
    },
  });

  // Filter service requests based on all filters
  const filteredServices = (serviceRequests || []).filter((service: any) => {
    // Search filter (job order, container, customer, description)
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      service.jobOrder?.toLowerCase().includes(searchLower) ||
      service.requestNumber?.toLowerCase().includes(searchLower) ||
      service.issueDescription?.toLowerCase().includes(searchLower) ||
      service.container?.containerCode?.toLowerCase().includes(searchLower) ||
      service.customer?.companyName?.toLowerCase().includes(searchLower);

    // Status filter
    const matchesStatus = statusFilter === "all" || service.status === statusFilter;

    // Work type filter
    const matchesWorkType = workTypeFilter === "all" || service.workType === workTypeFilter;

    // Billing type filter
    const matchesBilling = billingTypeFilter === "all" || service.billingType === billingTypeFilter;

    // Client type filter
    const matchesClientType = clientTypeFilter === "all" || service.clientType === clientTypeFilter;

    // Date filter
    const serviceDate = service.requestedAt ? new Date(service.requestedAt) : null;
    const matchesDateFrom = !dateFrom || !serviceDate || serviceDate >= dateFrom;
    const matchesDateTo = !dateTo || !serviceDate || serviceDate <= dateTo;

    return matchesSearch && matchesStatus && matchesWorkType && matchesBilling &&
           matchesClientType && matchesDateFrom && matchesDateTo;
  });

  // Get unique values for filters
  const workTypes = [...new Set((serviceRequests || []).map((s: any) => s.workType).filter(Boolean))];
  const billingTypes = [...new Set((serviceRequests || []).map((s: any) => s.billingType).filter(Boolean))];
  const clientTypes = [...new Set((serviceRequests || []).map((s: any) => s.clientType).filter(Boolean))];

  // Calculate statistics
  const stats = {
    total: filteredServices.length,
    completed: filteredServices.filter((s: any) => s.status === "completed").length,
    pending: filteredServices.filter((s: any) => s.status === "pending").length,
    inProgress: filteredServices.filter((s: any) => s.status === "in_progress").length,
    totalCost: filteredServices.reduce((sum: number, s: any) => sum + (parseFloat(s.totalCost) || 0), 0),
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setWorkTypeFilter("all");
    setBillingTypeFilter("all");
    setClientTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || workTypeFilter !== "all" ||
                          billingTypeFilter !== "all" || clientTypeFilter !== "all" || dateFrom || dateTo;

  // Pagination logic
  const totalItems = filteredServices.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedServices = filteredServices.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, workTypeFilter, billingTypeFilter, clientTypeFilter, dateFrom, dateTo]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Wrench className="h-8 w-8" />
                Service History
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive service records with advanced filtering
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Services</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">₹{stats.totalCost.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="col-span-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by job order, container, customer, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>

                {/* Work Type Filter */}
                <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Work Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Work Types</SelectItem>
                    {workTypes.map((type: string) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Billing Type Filter */}
                <Select value={billingTypeFilter} onValueChange={setBillingTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Billing Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Billing Types</SelectItem>
                    {billingTypes.map((type: string) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Client Type Filter */}
                <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Client Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Client Types</SelectItem>
                    {clientTypes.map((type: string) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date From */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "Date From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Date To */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "Date To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Service List */}
          <Card>
            <CardHeader>
              <CardTitle>
                Service Records ({filteredServices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading service history...</p>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters ? "No services match your filters" : "No service history available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedServices.map((service: any) => (
                    <div key={service.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {service.jobOrder && (
                            <Badge variant="outline" className="font-mono">
                              {service.jobOrder}
                            </Badge>
                          )}
                          {!service.jobOrder && service.requestNumber && (
                            <Badge variant="outline" className="font-mono">
                              SR#{service.requestNumber}
                            </Badge>
                          )}
                          <Badge className={
                            service.status === 'completed' ? 'bg-green-500/20 text-green-700 border-green-400/30 border' :
                            service.status === 'in_progress' ? 'bg-blue-500/20 text-blue-700 border-blue-400/30 border' :
                            service.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700 border-yellow-400/30 border' :
                            'bg-gray-500/20 text-gray-700 border-gray-400/30 border'
                          }>
                            {service.callStatus || service.status}
                          </Badge>
                        </div>
                        <Link href={`/service-requests/${service.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        {service.container?.containerCode && (
                          <div>
                            <label className="text-muted-foreground text-xs">Container</label>
                            <p className="font-medium">{service.container.containerCode}</p>
                          </div>
                        )}
                        {service.customer?.companyName && (
                          <div>
                            <label className="text-muted-foreground text-xs">Customer</label>
                            <p className="font-medium">{service.customer.companyName}</p>
                          </div>
                        )}
                        {service.workType && (
                          <div>
                            <label className="text-muted-foreground text-xs">Work Type</label>
                            <p className="font-medium">{service.workType}</p>
                          </div>
                        )}
                        {service.jobType && (
                          <div>
                            <label className="text-muted-foreground text-xs">Job Type</label>
                            <p className="font-medium">{service.jobType}</p>
                          </div>
                        )}
                        {service.billingType && (
                          <div>
                            <label className="text-muted-foreground text-xs">Billing</label>
                            <p className="font-medium">{service.billingType}</p>
                          </div>
                        )}
                        {service.clientType && (
                          <div>
                            <label className="text-muted-foreground text-xs">Client Type</label>
                            <p className="font-medium">{service.clientType}</p>
                          </div>
                        )}
                        {service.requestedAt && (
                          <div>
                            <label className="text-muted-foreground text-xs">Date</label>
                            <p className="font-medium">{new Date(service.requestedAt).toLocaleDateString()}</p>
                          </div>
                        )}
                        {service.totalCost && (
                          <div>
                            <label className="text-muted-foreground text-xs">Cost</label>
                            <p className="font-medium">₹{parseFloat(service.totalCost).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      {service.issueDescription && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground">{service.issueDescription}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {!isLoading && filteredServices.length > 0 && (
                <div className="mt-6 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
                    </span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 / page</SelectItem>
                        <SelectItem value="50">50 / page</SelectItem>
                        <SelectItem value="100">100 / page</SelectItem>
                        <SelectItem value="200">200 / page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNumber)}
                            className="w-10"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
