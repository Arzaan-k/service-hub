import { useState, useMemo, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, Eye, MapPin, Calendar, Package, Zap } from "lucide-react";

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

export default function Containers() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const authToken = getAuthToken();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("containerCode");

  const { data: containers = [], isLoading, error } = useQuery({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      const data = await response.json();
      console.log('[Containers Page] Fetched containers:', data.length, 'containers');
      return data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Debug logging
  useEffect(() => {
    console.log('[Containers Page] Render state:', {
      isLoading,
      hasError: !!error,
      containerCount: containers.length
    });
  }, [isLoading, error, containers]);

  // Initialize data on component mount
  useEffect(() => {
    // Removed test auth initialization - was causing conflicts with real authentication
  }, []);

  const filteredAndSortedContainers = useMemo(() => {
    let filtered = containers.filter((container: Container) => {
      const metadata = container.excelMetadata || {};
      const search = (searchTerm || "").toLowerCase();

      const containerCode = (
        container.containerCode ||
        (container as any).container_id ||
        ""
      )?.toString()?.toLowerCase() || "";

      const productType = (
        metadata.productType ||
        (container as any).product_type ||
        ""
      )?.toString()?.toLowerCase() || "";

      const location = (
        metadata.location ||
        (container as any).available_location ||
        ""
      )?.toString()?.toLowerCase() || "";

      const depot = (
        metadata.depot ||
        (container as any).depot ||
        ""
      )?.toString()?.toLowerCase() || "";

      const matchesSearch = 
        containerCode.includes(search) ||
        productType.includes(search) ||
        location.includes(search) ||
        depot.includes(search);
      
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "deployed" && metadata.status === "DEPLOYED") ||
        (statusFilter === "sale" && metadata.status === "SALE") ||
        (statusFilter === "sold" && metadata.status === "SOLD") ||
        (statusFilter === "maintenance" && container.status === "maintenance");
      
      const matchesType = typeFilter === "all" || 
        (typeFilter === "reefer" && metadata.productType === "Reefer") ||
        (typeFilter === "dry" && metadata.productType === "Dry");
      
      const matchesGrade = gradeFilter === "all" || 
        metadata.grade === gradeFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesType && matchesGrade;
    });

    // Sort containers
    filtered.sort((a: Container, b: Container) => {
      switch (sortBy) {
        case "containerCode":
          return (
            (a.containerCode || (a as any).container_id || "").toString()
          ).localeCompare(
            (b.containerCode || (b as any).container_id || "").toString()
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
    });

    return filtered;
  }, [containers, searchTerm, statusFilter, typeFilter, gradeFilter, sortBy]);

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#0b1220] text-white">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Container Master Sheet" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1f3b7a] mx-auto mb-4"></div>
              <p className="text-white/80">Loading containers...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <Header title="Container Master Sheet" />
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
            <Card className="card-surface">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Containers</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{containers.length}</div>
                <p className="text-xs text-muted-foreground">All containers</p>
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Deployed</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {containers.filter((c: Container) => c.excelMetadata?.status === "DEPLOYED").length}
                </div>
                <p className="text-xs text-muted-foreground">Active containers</p>
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">For Sale</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {containers.filter((c: Container) => c.excelMetadata?.status === "SALE").length}
                </div>
                <p className="text-xs text-muted-foreground">Available for sale</p>
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Average Grade</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {(() => {
                    const grades = containers.map((c: Container) => c.excelMetadata?.grade).filter(Boolean);
                    const gradeValues = grades.map(g => g === 'A' ? 4 : g === 'B' ? 3 : g === 'C' ? 2 : 1);
                    return gradeValues.length > 0 ? (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(1) : 'N/A';
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">Quality rating</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6 card-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Filter className="h-5 w-5 text-muted-foreground" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search containers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 input-soft placeholder:text-[#7a7a7a]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="input-soft h-10">
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
                  <SelectTrigger className="input-soft h-10">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                    <SelectItem value="dry">Dry</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger className="input-soft h-10">
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
                  <SelectTrigger className="input-soft h-10">
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
                <Button variant="outline" className="btn-secondary flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Container Table */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle className="text-foreground">Container Master Sheet ({filteredAndSortedContainers.length} containers)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-soft">
                  <thead className="border-b" style={{ borderColor: '#FFE0D6' }}>
                    <tr>
                      {/* Match DB field name for primary identifier */}
                      <th className="text-left py-3 px-2">container_id</th>
                      <th className="text-left py-3 px-2">Product Type</th>
                      <th className="text-left py-3 px-2">Size</th>
                      <th className="text-left py-3 px-2">Size Type</th>
                      <th className="text-left py-3 px-2">Group Name</th>
                      <th className="text-left py-3 px-2">GKU Product Name</th>
                      <th className="text-left py-3 px-2">Category</th>
                      <th className="text-left py-3 px-2">Location</th>
                      <th className="text-left py-3 px-2">Depot</th>
                      <th className="text-left py-3 px-2">YOM</th>
                      <th className="text-left py-3 px-2">Status</th>
                      <th className="text-left py-3 px-2">Current</th>
                      <th className="text-left py-3 px-2">Grade</th>
                      <th className="text-left py-3 px-2">Reefer Unit</th>
                      <th className="text-left py-3 px-2">Reefer Unit Model</th>
                      <th className="text-left py-3 px-2">Health Score</th>
                      <th className="text-left py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedContainers.map((container: Container) => {
                      const metadata = container.excelMetadata || {};
                      const containerNumber =
                        (container as any).container_no ||
                        container.containerCode ||
                        (container as any).container_id ||
                        "";
                      return (
                        <tr 
                          key={container.id} 
                          className="border-b cursor-pointer"
                          style={{ borderColor: '#FFE0D6' }}
                          onClick={() => setLocation(`/containers/${container.id}`)}
                        >
                          <td className="py-3 px-2 font-mono text-xs font-medium text-foreground">
                            {containerNumber || "—"}
                          </td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.productType || container.type}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.size || container.capacity}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.sizeType || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.groupName || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.gkuProductName || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.category || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.location || 'Unknown'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.depot || 'Unknown'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.yom || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getStatusBadge(metadata.status || container.status)}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.current || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getGradeBadge(metadata.grade || 'N/A')}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.reeferUnit || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-foreground">{metadata.reeferUnitModel || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getHealthScoreBadge(container.healthScore || 0)}</td>
                          <td className="py-3 px-2 text-xs">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-foreground hover:bg-[#FFF6F9]"
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
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
