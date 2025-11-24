import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
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

// CSV/import-driven fields from the containers table to display in the UI
const csvFieldDefinitions: { key: string; label: string }[] = [
  // labels match DB column names exactly as requested
  { key: "product_type", label: "product_type" },
  { key: "size", label: "size" },
  { key: "size_type", label: "size_type" },
  { key: "group_name", label: "group_name" },
  { key: "gku_product_name", label: "gku_product_name" },
  { key: "category", label: "category" },
  { key: "available_location", label: "available_location" },
  { key: "depot", label: "depot" },
  { key: "mfg_year", label: "mfg_year" },
  { key: "inventory_status", label: "inventory_status" },
  { key: "current", label: "current" },
  { key: "images_pti_survey", label: "images_pti_survey" },
  { key: "grade", label: "grade" },
  { key: "purchase_date", label: "purchase_date" },
  { key: "temperature", label: "temperature" },
  { key: "domestication", label: "domestication" },
  { key: "reefer_unit", label: "reefer_unit" },
  { key: "reefer_unit_model_name", label: "reefer_unit_model_name" },
  { key: "reefer_unit_serial_no", label: "reefer_unit_serial_no" },
  { key: "controller_configuration_number", label: "controller_configuration_number" },
  { key: "controller_version", label: "controller_version" },
  { key: "city_of_purchase", label: "city_of_purchase" },
  { key: "purchase_yard_details", label: "purchase_yard_details" },
  { key: "cro_number", label: "cro_number" },
  { key: "brand_new_used", label: "brand_new_used" },
  { key: "date_of_arrival_in_depot", label: "date_of_arrival_in_depot" },
  { key: "in_house_run_test_report", label: "in_house_run_test_report" },
  { key: "condition", label: "condition" },
  { key: "curtains", label: "curtains" },
  { key: "lights", label: "lights" },
  { key: "colour", label: "colour" },
  { key: "logo_sticker", label: "logo_sticker" },
  { key: "repair_remarks", label: "repair_remarks" },
  { key: "estimated_cost_for_repair", label: "estimated_cost_for_repair" },
  { key: "crystal_smart_sr_no", label: "crystal_smart_sr_no" },
  { key: "booking_order_number", label: "booking_order_number" },
  { key: "do_number", label: "do_number" },
  { key: "dispatch_date", label: "dispatch_date" },
  { key: "no_of_days", label: "no_of_days" },
  { key: "dispatch_location", label: "dispatch_location" },
  { key: "set_temperature_during_despatch_live", label: "set_temperature_during_despatch_live" },
  { key: "assets_belong_to", label: "assets_belong_to" },
  { key: "blocked", label: "blocked" },
  { key: "remark", label: "remark" },
];

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
  console.log('[Containers Page] Filter values:', { searchTerm, statusFilter, typeFilter, gradeFilter, hasActiveFilters });
  console.log('[Containers Page] Query key will be:', hasActiveFilters
    ? ["/api/containers", "all"]
    : ["/api/containers", "paginated", currentPage, itemsPerPage]);
  console.log('[Containers Page] Current page:', currentPage, 'Items per page:', itemsPerPage);
  console.log('[Containers Page] About to run main query with hasActiveFilters:', hasActiveFilters);

  // Query for summary statistics (always fetch all containers)
  const { data: allContainers = [] } = useQuery({
    queryKey: ["/api/containers", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      const data = await response.json();
      console.log('[Containers Page] Fetched all containers for stats:', Array.isArray(data) ? data.length : 'Not an array');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const { data: containersData, isLoading, error } = useQuery({
    queryKey: hasActiveFilters
      ? ["/api/containers", "all"] // Fetch all for filtering
      : ["/api/containers", "paginated", currentPage, itemsPerPage], // Use pagination
    queryFn: async () => {
      console.log('[Containers Page] Query function called, hasActiveFilters:', hasActiveFilters);
      if (hasActiveFilters) {
        // Fetch all containers for client-side filtering
        const response = await apiRequest("GET", "/api/containers");
        const data = await response.json();
        console.log('[Containers Page] Fetched all containers for filtering:', Array.isArray(data) ? data.length : 'Not an array');
        return {
          containers: Array.isArray(data) ? data : [],
          totalCount: Array.isArray(data) ? data.length : 0,
          isPaginated: false
        };
      } else {
        // Use server-side pagination
        const offset = (currentPage - 1) * itemsPerPage;
        const url = `/api/containers?limit=${itemsPerPage}&offset=${offset}`;
        const response = await apiRequest("GET", url);
        const data = await response.json();
        const totalCount = parseInt(response.headers.get('x-total-count') || '0');

        console.log('[Containers Page] Fetched paginated containers:', Array.isArray(data) ? data.length : 'Not an array', 'Total:', totalCount);
        if (data.length > 0) {
          console.log('[Containers Page] First container sample:', data[0]);
          console.log('[Containers Page] Container keys:', Object.keys(data[0]));
          console.log('[Containers Page] product_type:', data[0].product_type);
          console.log('[Containers Page] depot:', data[0].depot);
          console.log('[Containers Page] grade:', data[0].grade);
        }

        const result = {
          containers: Array.isArray(data) ? data : [],
          totalCount,
          isPaginated: true
        };
        console.log('[Containers Page] Returning paginated result:', result);
        return result;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Handle different response formats
  const containers = containersData?.containers || (Array.isArray(containersData) ? containersData : []) || allContainers;
  const totalCount = containersData?.totalCount || (Array.isArray(containersData) ? containersData.length : 0) || allContainers.length;
  const isUsingPagination = containersData?.isPaginated || false;

  console.log('[Containers Page] containersData:', containersData);
  console.log('[Containers Page] allContainers:', allContainers, 'length:', allContainers.length);
  console.log('[Containers Page] containers (final):', containers, 'length:', containers.length);

  // Debug logging
  useEffect(() => {
    console.log('[Containers Page] Render state:', {
      isLoading,
      hasError: !!error,
      containerCount: Array.isArray(containers) ? containers.length : 'Not an array'
    });
  }, [isLoading, error, containers]);

  // Initialize data on component mount
  useEffect(() => {
    // Removed test auth initialization - was causing conflicts with real authentication
  }, []);

  console.log('[Containers Page] About to process filteredAndSortedContainers, containers:', containers, 'type:', typeof containers, 'isArray:', Array.isArray(containers));

  const filteredAndSortedContainers = useMemo(() => {
    console.log('[useMemo] Starting with containers:', containers, 'hasActiveFilters:', hasActiveFilters, 'isUsingPagination:', isUsingPagination);
    if (!Array.isArray(containers)) {
      console.warn("Containers data is not an array:", containers);
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
      "DEPLOYED": { color: "bg-green-500/20 text-green-400", label: "Deployed" },
      "SALE": { color: "bg-blue-500/20 text-blue-400", label: "For Sale" },
      "SOLD": { color: "bg-red-500/20 text-red-400", label: "Sold" },
      "MAINTENANCE": { color: "bg-yellow-500/20 text-yellow-400", label: "Maintenance" },
      "STOCK": { color: "bg-gray-500/20 text-gray-400", label: "In Stock" },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || { color: "bg-gray-500/20 text-gray-400", label: status };
    return <Badge className={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  const getGradeBadge = (grade: string) => {
    const gradeMap = {
      "A": { color: "bg-green-500/20 text-green-400", label: "A" },
      "B": { color: "bg-yellow-500/20 text-yellow-400", label: "B" },
      "C": { color: "bg-red-500/20 text-red-400", label: "C" },
      "D": { color: "bg-red-500/20 text-red-400", label: "D" },
    };
    const gradeInfo = gradeMap[grade as keyof typeof gradeMap] || { color: "bg-gray-500/20 text-gray-400", label: grade };
    return <Badge className={gradeInfo.color}>{gradeInfo.label}</Badge>;
  };

  const getHealthScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500/20 text-green-400">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-500/20 text-yellow-400">Good</Badge>;
    if (score >= 50) return <Badge className="bg-orange-500/20 text-orange-400">Fair</Badge>;
    return <Badge className="bg-red-500/20 text-red-400">Poor</Badge>;
  };

  console.log('[Containers Page] isLoading:', isLoading, 'hasError:', !!error, 'containersData:', containersData);
  console.log('[Containers Page] About to check loading condition');
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574621100236-d25b64cfd647?q=80&w=2833&auto=format&fit=crop')] bg-cover bg-center opacity-5 pointer-events-none" />
          <Header title="Container Master Sheet" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
              <p className="text-muted-foreground text-lg animate-pulse">Loading fleet data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574621100236-d25b64cfd647?q=80&w=2833&auto=format&fit=crop')] bg-cover bg-center opacity-5 pointer-events-none" />
        <Header title="Container Master Sheet" />
        <div className="flex-1 overflow-y-auto p-8 space-y-8 relative z-10">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <AnimatedCard gradientColor="#3B82F6" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Total Containers</h3>
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{containers.length}</div>
              <p className="text-xs text-muted-foreground">All containers in fleet</p>
            </AnimatedCard>

            <AnimatedCard gradientColor="#10B981" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Deployed</h3>
                <div className="p-2 bg-green-500/10 rounded-lg">
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
                <div className="p-2 bg-amber-500/10 rounded-lg">
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
                <div className="p-2 bg-purple-500/10 rounded-lg">
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
              <div className="p-2 bg-primary/10 rounded-lg">
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
                  className="pl-10 bg-white/5 border-white/10 focus:bg-white/10 transition-all"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/10">
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
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="reefer">Reefer</SelectItem>
                  <SelectItem value="dry">Dry</SelectItem>
                </SelectContent>
              </Select>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="bg-white/5 border-white/10">
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
                <SelectTrigger className="bg-white/5 border-white/10">
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
              <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-primary transition-all flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </GlassCard>

          {/* Container Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Container Master Sheet <span className="text-muted-foreground text-sm font-normal ml-2">({totalItems} containers)</span></h3>
            </div>
            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-xs uppercase text-muted-foreground font-semibold">
                    <tr>
                      {/* Match DB field name for primary identifier */}
                      <th className="text-left py-4 px-4">container_id</th>
                      <th className="text-left py-4 px-4">Product Type</th>
                      <th className="text-left py-4 px-4">Size</th>
                      <th className="text-left py-4 px-4">Size Type</th>
                      <th className="text-left py-4 px-4">Group Name</th>
                      <th className="text-left py-4 px-4">GKU Product Name</th>
                      <th className="text-left py-4 px-4">Category</th>
                      <th className="text-left py-4 px-4">Location</th>
                      <th className="text-left py-4 px-4">Depot</th>
                      <th className="text-left py-4 px-4">YOM</th>
                      <th className="text-left py-4 px-4">Status</th>
                      <th className="text-left py-4 px-4">Current</th>
                      <th className="text-left py-4 px-4">Grade</th>
                      <th className="text-left py-4 px-4">Reefer Unit</th>
                      <th className="text-left py-4 px-4">Reefer Unit Model</th>
                      <th className="text-left py-4 px-4">Health Score</th>
                      <th className="text-left py-4 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="py-8 text-center text-muted-foreground">
                          No containers found
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
                            className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                            onClick={() => setLocation(`/containers/${container.id}`)}
                          >
                            <td className="py-4 px-4 font-mono text-xs font-medium text-primary group-hover:text-primary-light transition-colors">
                              {containerNumber || "—"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).productType ||
                                (container as any).product_type ||
                                metadata.productType ||
                                container.type ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).size || metadata.size || container.capacity || "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).sizeType ||
                                (container as any).size_type ||
                                metadata.sizeType ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).groupName ||
                                (container as any).group_name ||
                                metadata.groupName ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).gkuProductName ||
                                (container as any).gku_product_name ||
                                metadata.gkuProductName ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).category || metadata.category || "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).availableLocation ||
                                (container as any).available_location ||
                                metadata.location ||
                                "Unknown"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).depot || metadata.depot || "Unknown"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).mfgYear ||
                                (container as any).mfg_year ||
                                metadata.yom ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs">
                              {getStatusBadge(
                                (container as any).inventoryStatus ||
                                (container as any).inventory_status ||
                                metadata.status ||
                                container.status
                              )}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).current || metadata.current || "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs">
                              {getGradeBadge((container as any).grade || metadata.grade || "N/A")}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).reeferUnit ||
                                (container as any).reefer_unit ||
                                metadata.reeferUnit ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs text-foreground/80">
                              {(container as any).reeferUnitModelName ||
                                (container as any).reefer_unit_model_name ||
                                (container as any).reeferModel ||
                                (container as any).reefer_model ||
                                metadata.reeferUnitModel ||
                                "N/A"}
                            </td>
                            <td className="py-4 px-4 text-xs">
                              {getHealthScoreBadge(container.healthScore || 0)}
                            </td>
                            <td className="py-4 px-4 text-xs">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
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
                <div className="flex items-center justify-between px-2 py-4 border-t border-border">
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
                        <SelectTrigger className="h-8 w-[70px]">
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
                                    className="cursor-pointer"
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
