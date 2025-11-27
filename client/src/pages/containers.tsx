import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken, useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedCard, GlassCard } from "@/components/ui/animated-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Search, Filter, Download, Eye, MapPin, Calendar, Package, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface Container {
  id: string;
  containerCode: string;
  type: string;
  capacity: string;
  status: string;
  healthScore: number;
  currentLocation: {
    address?: string;
    depot?: string;
  };
  excelMetadata: {
    productType: string;
    size: string;
    sizeType: string;
    groupName: string;
    gkuProductName: string;
    category: string;
    location: string;
    depot: string;
    yom: number;
    status: string;
    current: string;
    imageLinks: string;
    grade: string;
    reeferUnit: string;
    reeferUnitModel: string;
  };
  [key: string]: any;
}

const safeLower = (val: any): string => {
  if (val === null || val === undefined) return "";
  try {
    return String(val).toLowerCase();
  } catch (e) {
    console.error("Error in safeLower:", e, val);
    return "";
  }
};

export default function Containers() {
  console.log('[Containers Page] Component rendering - DEBUG');
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const authToken = getAuthToken();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("containerCode");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Determine if we should use pagination or fetch all data for filtering
  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || typeFilter !== "all" || gradeFilter !== "all";

  // Determine API endpoints based on user role
  const isClient = user?.role === 'client';
  const containersEndpoint = isClient ? "/api/customers/me/containers" : "/api/containers";

  // Query for summary statistics (always fetch all containers for stats)
  const { data: allContainers = [] } = useQuery({
    queryKey: ["/api/containers", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    enabled: !isClient, // Only fetch all containers for non-clients (for stats)
  });

  const { data: containersData, isLoading, error } = useQuery({
    queryKey: hasActiveFilters
      ? [containersEndpoint, "all"] // Fetch all for filtering
      : [containersEndpoint, "paginated", currentPage, itemsPerPage], // Use pagination
    queryFn: async () => {
      if (hasActiveFilters) {
        // Fetch all containers for client-side filtering
        const response = await apiRequest("GET", containersEndpoint);
        const data = await response.json();
        return {
          containers: Array.isArray(data) ? data : [],
          totalCount: Array.isArray(data) ? data.length : 0,
          isPaginated: false
        };
      }

      // Use server-side pagination (only for non-clients)
      if (isClient) {
        // For clients, fetch all containers (they likely have fewer containers)
        const response = await apiRequest("GET", containersEndpoint);
        const data = await response.json();
        return {
          containers: Array.isArray(data) ? data : [],
          totalCount: Array.isArray(data) ? data.length : 0,
          isPaginated: false
        };
      }

      // For admins/coordinators/technicians, use pagination
      const offset = (currentPage - 1) * itemsPerPage;
      const url = `/api/containers?limit=${itemsPerPage}&offset=${offset}`;
      const response = await apiRequest("GET", url);
      const data = await response.json();
      const totalCount = parseInt(response.headers.get('x-total-count') || '0');

      return {
        containers: Array.isArray(data) ? data : [],
        totalCount,
        isPaginated: true
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Handle different response formats
  const containers = containersData?.containers || (Array.isArray(containersData) ? containersData : []) || allContainers;
  const totalCount = containersData?.totalCount || (Array.isArray(containersData) ? containersData.length : 0) || allContainers.length;
  const isUsingPagination = containersData?.isPaginated || false;

  const filteredAndSortedContainers = useMemo(() => {
    if (!Array.isArray(containers)) {
      return [];
    }

    // Apply filtering and sorting for client-side processing when filters are active
    let filtered = containers.filter((container: Container) => {
      if (!container) return false;

      try {
        const metadata = container.excelMetadata || {};
        const search = safeLower(searchTerm);

        const containerCode = safeLower(
          container.containerCode ||
          (container as any).container_id ||
          (container as any).containerNo
        );

        const productType = safeLower(
          (container as any).productType ||
          (container as any).product_type ||
          metadata.productType
        );

        const location = safeLower(
          (container as any).availableLocation ||
          (container as any).available_location ||
          metadata.location
        );

        const depot = safeLower(
          (container as any).depot ||
          metadata.depot
        );

        const matchesSearch =
          containerCode.includes(search) ||
          productType.includes(search) ||
          location.includes(search) ||
          depot.includes(search);

        const matchesStatus = statusFilter === "all" ||
          (statusFilter === "deployed" && ((container as any).inventoryStatus === "DEPLOYED" || (container as any).inventory_status === "DEPLOYED" || metadata.status === "DEPLOYED")) ||
          (statusFilter === "sale" && ((container as any).inventoryStatus === "SALE" || (container as any).inventory_status === "SALE" || metadata.status === "SALE")) ||
          (statusFilter === "sold" && ((container as any).inventoryStatus === "SOLD" || (container as any).inventory_status === "SOLD" || metadata.status === "SOLD")) ||
          (statusFilter === "maintenance" && (container.status === "maintenance" || (container as any).inventoryStatus === "maintenance" || (container as any).inventory_status === "maintenance"));

        const matchesType = typeFilter === "all" ||
          (typeFilter === "reefer" && ((container as any).productType === "Reefer" || (container as any).product_type === "Reefer" || metadata.productType === "Reefer")) ||
          (typeFilter === "dry" && ((container as any).productType === "Dry" || (container as any).product_type === "Dry" || metadata.productType === "Dry"));

        const matchesGrade = gradeFilter === "all" ||
          ((container as any).grade === gradeFilter.toUpperCase() || metadata.grade === gradeFilter.toUpperCase());

        return matchesSearch && matchesStatus && matchesType && matchesGrade;
      } catch (err) {
        console.error("Error filtering container:", container, err);
        return false;
      }
    });

    // Sort containers
    filtered.sort((a: Container, b: Container) => {
      try {
        switch (sortBy) {
          case "containerCode":
            return safeLower(a.containerCode || (a as any).container_id).localeCompare(
              safeLower(b.containerCode || (b as any).container_id)
            );
          case "status":
            return (a.excelMetadata?.status || "").localeCompare(b.excelMetadata?.status || "");
          case "location":
            return (a.excelMetadata?.location || "").localeCompare(b.excelMetadata?.location || "");
          case "grade":
            return (a.excelMetadata?.grade || "").localeCompare(b.excelMetadata?.grade || "");
          case "yom":
            return (b.excelMetadata?.yom || 0) - (a.excelMetadata?.yom || 0);
          default:
            return 0;
        }
      } catch (err) {
        console.error("Error sorting containers:", err);
        return 0;
      }
    });

    return filtered;
  }, [containers, searchTerm, statusFilter, typeFilter, gradeFilter, sortBy, isUsingPagination]);

  // Pagination calculations
  const displayItems = hasActiveFilters ? filteredAndSortedContainers : containers;
  const totalItems = hasActiveFilters ? filteredAndSortedContainers.length : totalCount;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  // Get the items to display based on pagination
  const paginatedItems = hasActiveFilters
    ? displayItems.slice(startIndex, endIndex)
    : displayItems;

  // Reset to page 1 when filters change or pagination mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, gradeFilter, itemsPerPage, hasActiveFilters]);

  const getStatusBadge = (status: string) => {
    const statusMap = {
      "DEPLOYED": { color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20", label: "Deployed" },
      "SALE": { color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20", label: "For Sale" },
      "SOLD": { color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20", label: "Sold" },
      "MAINTENANCE": { color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", label: "Maintenance" },
      "STOCK": { color: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/20", label: "In Stock" },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || { color: "bg-gray-500/20 text-gray-600 dark:text-gray-400", label: status };
    return <Badge variant="outline" className={`${statusInfo.color} border font-medium`}>{statusInfo.label}</Badge>;
  };

  const getGradeBadge = (grade: string) => {
    const gradeMap = {
      "A": { color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20", label: "A" },
      "B": { color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", label: "B" },
      "C": { color: "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/20", label: "C" },
      "D": { color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20", label: "D" },
    };
    const gradeInfo = gradeMap[grade as keyof typeof gradeMap] || { color: "bg-gray-500/20 text-gray-600 dark:text-gray-400", label: grade };
    return <Badge variant="outline" className={`${gradeInfo.color} border font-medium`}>{gradeInfo.label}</Badge>;
  };

  const getHealthScoreBadge = (score: number) => {
    if (score >= 90) return <Badge variant="outline" className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20">Excellent</Badge>;
    if (score >= 70) return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">Good</Badge>;
    if (score >= 50) return <Badge variant="outline" className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/20">Fair</Badge>;
    return <Badge variant="outline" className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20">Poor</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative" style={{ backgroundImage: 'none' }}>
          <Header title="Container Master Sheet" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
              <p className="text-muted-foreground text-lg animate-pulse">Loading container fleet...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen bg-background relative" style={{ backgroundImage: 'none' }}>
        <Header title="Container Master Sheet" />
        <div className="flex-1 p-4 lg:p-8 space-y-8 relative z-10">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <AnimatedCard gradientColor="#3B82F6" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Total Containers</h3>
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{containers.length}</div>
              <p className="text-xs text-muted-foreground">All containers in fleet</p>
            </AnimatedCard>

            <AnimatedCard gradientColor="#10B981" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Deployed</h3>
                <div className="p-2 bg-green-500/10 rounded-xl">
                  <MapPin className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">
                {containers.filter((c: Container) => c.excelMetadata?.status === "DEPLOYED").length}
              </div>
              <p className="text-xs text-muted-foreground">Active in transit</p>
            </AnimatedCard>

            <AnimatedCard gradientColor="#F59E0B" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">For Sale</h3>
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">
                {containers.filter((c: Container) => c.excelMetadata?.status === "SALE").length}
              </div>
              <p className="text-xs text-muted-foreground">Available inventory</p>
            </AnimatedCard>

            <AnimatedCard gradientColor="#8B5CF6" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Avg Grade</h3>
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">
                {(() => {
                  const grades = containers.map((c: Container) => c.excelMetadata?.grade).filter(Boolean);
                  const gradeValues = grades.map(g => g === 'A' ? 4 : g === 'B' ? 3 : g === 'C' ? 2 : 1);
                  return gradeValues.length > 0 ? (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(1) : 'N/A';
                })()}
              </div>
              <p className="text-xs text-muted-foreground">Quality rating</p>
            </AnimatedCard>
          </div>

          {/* Filters and Search */}
          <GlassCard className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Filters & Search</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search containers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/50 dark:bg-black/20 border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-black/40 transition-all rounded-xl"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/50 dark:bg-black/20 border-transparent focus:border-primary/30 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="deployed">Deployed</SelectItem>
                  <SelectItem value="sale">For Sale</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-white/50 dark:bg-black/20 border-transparent focus:border-primary/30 rounded-xl">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="reefer">Reefer</SelectItem>
                  <SelectItem value="dry">Dry</SelectItem>
                </SelectContent>
              </Select>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="bg-white/50 dark:bg-black/20 border-transparent focus:border-primary/30 rounded-xl">
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  <SelectItem value="a">Grade A</SelectItem>
                  <SelectItem value="b">Grade B</SelectItem>
                  <SelectItem value="c">Grade C</SelectItem>
                  <SelectItem value="d">Grade D</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-white/50 dark:bg-black/20 border-transparent focus:border-primary/30 rounded-xl">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="containerCode">Container Number</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="grade">Grade</SelectItem>
                  <SelectItem value="yom">Year of Manufacture</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="bg-white/50 dark:bg-black/20 border-transparent hover:bg-primary hover:text-white transition-all flex items-center gap-2 rounded-xl">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </GlassCard>

          {/* Container Table */}
          <GlassCard className="overflow-hidden p-0 border-0 shadow-xl">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/40 dark:bg-black/20 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-foreground">Container Master Sheet <span className="text-muted-foreground text-sm font-normal ml-2">({totalItems} containers)</span></h3>
            </div>
            <div className="p-0">
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {paginatedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Package className="h-12 w-12 text-muted-foreground/30" />
                    <p>No containers found</p>
                  </div>
                ) : (
                  paginatedItems.map((container: Container) => {
                    const metadata = container.excelMetadata || {};
                    const containerNumber =
                      (container as any).container_no ||
                      container.containerCode ||
                      (container as any).container_id ||
                      "";

                    return (
                      <div
                        key={container.id}
                        className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-200"
                        onClick={() => setLocation(`/containers/${container.id}`)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-mono font-bold text-primary text-lg">{containerNumber || "—"}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(container as any).productType || metadata.productType || "N/A"} • {(container as any).size || metadata.size || "N/A"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(
                              (container as any).inventoryStatus ||
                              (container as any).inventory_status ||
                              metadata.status ||
                              container.status
                            )}
                            {getHealthScoreBadge(container.healthScore || 0)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Location</span>
                            <span className="truncate font-medium">
                              {(container as any).availableLocation || metadata.location || "Unknown"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Depot</span>
                            <span className="truncate font-medium">
                              {(container as any).depot || metadata.depot || "Unknown"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Grade</span>
                            <span className="font-medium">
                              {getGradeBadge((container as any).grade || metadata.grade || "N/A")}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">YOM</span>
                            <span className="font-medium">
                              {(container as any).mfgYear || metadata.yom || "N/A"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {(container as any).current || metadata.current || "No current status"}
                          </span>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto max-h-[600px] scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-xl text-xs uppercase text-muted-foreground font-semibold shadow-sm">
                    <tr>
                      {/* Match DB field name for primary identifier */}
                      <th className="text-left py-4 px-4 font-bold tracking-wider">container_id</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Product Type</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Size</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Size Type</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Group Name</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">GKU Product Name</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Category</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Location</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Depot</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">YOM</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Status</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Current</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Grade</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Reefer Unit</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Reefer Unit Model</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Health Score</th>
                      <th className="text-left py-4 px-4 font-bold tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Package className="h-12 w-12 text-muted-foreground/30" />
                            <p>No containers found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((container: Container) => {
                        const metadata = container.excelMetadata || {};
                        const containerNumber =
                          (container as any).container_no ||
                          container.containerCode ||
                          (container as any).container_id ||
                          "";
                        return (
                          <tr
                            key={container.id}
                            className="hover:bg-primary/5 transition-colors cursor-pointer group"
                            onClick={() => setLocation(`/containers/${container.id}`)}
                          >
                            <td className="py-3 px-4 font-mono text-xs font-medium text-primary group-hover:text-primary-dark transition-colors">
                              {containerNumber || "—"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).productType ||
                                (container as any).product_type ||
                                metadata.productType ||
                                container.type ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).size || metadata.size || container.capacity || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).sizeType ||
                                (container as any).sizeType ||
                                metadata.sizeType ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).groupName ||
                                (container as any).group_name ||
                                metadata.groupName ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).gkuProductName ||
                                (container as any).gku_product_name ||
                                metadata.gkuProductName ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).category || metadata.category || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).availableLocation ||
                                (container as any).available_location ||
                                metadata.location ||
                                "Unknown"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).depot || metadata.depot || "Unknown"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).mfgYear ||
                                (container as any).mfg_year ||
                                metadata.yom ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {getStatusBadge(
                                (container as any).inventoryStatus ||
                                (container as any).inventory_status ||
                                metadata.status ||
                                container.status
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).current || metadata.current || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {getGradeBadge((container as any).grade || metadata.grade || "N/A")}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).reeferUnit ||
                                (container as any).reefer_unit ||
                                metadata.reeferUnit ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs text-foreground/80">
                              {(container as any).reeferUnitModelName ||
                                (container as any).reefer_unit_model_name ||
                                (container as any).reeferModel ||
                                (container as any).reefer_model ||
                                metadata.reeferUnitModel ||
                                "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {getHealthScoreBadge(container.healthScore || 0)}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/containers/${container.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md">
                  <div className="flex-1 text-sm text-muted-foreground">
                    {hasActiveFilters ? (
                      <span>Showing filtered results ({filteredAndSortedContainers.length} of {totalCount} total entries)</span>
                    ) : (
                      <span>Showing {startIndex + 1} to {endIndex} of {totalItems} entries</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                        value={`${itemsPerPage}`}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px] bg-white/50 dark:bg-black/20 border-transparent rounded-lg">
                          <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(currentPage - 1)}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Show first page, last page, current page, and pages around current
                            return page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 && page <= currentPage + 1);
                          })
                          .map((page, index, array) => {
                            // Add ellipsis when there are gaps
                            const showEllipsis = index > 0 && page - array[index - 1] > 1;

                            return (
                              <React.Fragment key={page}>
                                {showEllipsis && (
                                  <PaginationItem>
                                    <PaginationEllipsis />
                                  </PaginationItem>
                                )}
                                <PaginationItem>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(page)}
                                    isActive={currentPage === page}
                                    className={`cursor-pointer ${currentPage === page ? 'bg-primary text-white hover:bg-primary/90' : ''}`}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              </React.Fragment>
                            );
                          })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(currentPage + 1)}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
