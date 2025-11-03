import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
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
}

export default function Containers() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const authToken = getAuthToken();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("containerCode");

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Initialize data on component mount
  useEffect(() => {
    // Removed test auth initialization - was causing conflicts with real authentication
  }, []);

  const filteredAndSortedContainers = useMemo(() => {
    let filtered = containers.filter((container: Container) => {
      const metadata = container.excelMetadata || {};
      const matchesSearch = 
        container.containerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metadata.productType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metadata.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metadata.depot?.toLowerCase().includes(searchTerm.toLowerCase());
      
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
          return a.containerCode.localeCompare(b.containerCode);
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
    <div className="flex min-h-screen bg-[#0b1220] text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Container Master Sheet" />
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-[#0c1a2e] border-[#223351]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Total Containers</CardTitle>
                <Package className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{containers.length}</div>
                <p className="text-xs text-white/80">All containers</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0c1a2e] border-[#223351]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Deployed</CardTitle>
                <MapPin className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {containers.filter((c: Container) => c.excelMetadata?.status === "DEPLOYED").length}
                </div>
                <p className="text-xs text-white/80">Active containers</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0c1a2e] border-[#223351]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">For Sale</CardTitle>
                <Zap className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {containers.filter((c: Container) => c.excelMetadata?.status === "SALE").length}
                </div>
                <p className="text-xs text-white/80">Available for sale</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0c1a2e] border-[#223351]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Average Grade</CardTitle>
                <Calendar className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {(() => {
                    const grades = containers.map((c: Container) => c.excelMetadata?.grade).filter(Boolean);
                    const gradeValues = grades.map(g => g === 'A' ? 4 : g === 'B' ? 3 : g === 'C' ? 2 : 1);
                    return gradeValues.length > 0 ? (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(1) : 'N/A';
                  })()}
                </div>
                <p className="text-xs text-white/80">Quality rating</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6 bg-[#0c1a2e] border-[#223351]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Filter className="h-5 w-5 text-white" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/80" />
                  <Input
                    placeholder="Search containers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-[#0e2038] border-[#223351] text-white placeholder:text-white/60"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectItem value="all" className="focus:bg-[#1f3b7a]">All Status</SelectItem>
                    <SelectItem value="deployed" className="focus:bg-[#1f3b7a]">Deployed</SelectItem>
                    <SelectItem value="sale" className="focus:bg-[#1f3b7a]">For Sale</SelectItem>
                    <SelectItem value="sold" className="focus:bg-[#1f3b7a]">Sold</SelectItem>
                    <SelectItem value="maintenance" className="focus:bg-[#1f3b7a]">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectItem value="all" className="focus:bg-[#1f3b7a]">All Types</SelectItem>
                    <SelectItem value="reefer" className="focus:bg-[#1f3b7a]">Reefer</SelectItem>
                    <SelectItem value="dry" className="focus:bg-[#1f3b7a]">Dry</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectValue placeholder="Grade" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectItem value="all" className="focus:bg-[#1f3b7a]">All Grades</SelectItem>
                    <SelectItem value="a" className="focus:bg-[#1f3b7a]">Grade A</SelectItem>
                    <SelectItem value="b" className="focus:bg-[#1f3b7a]">Grade B</SelectItem>
                    <SelectItem value="c" className="focus:bg-[#1f3b7a]">Grade C</SelectItem>
                    <SelectItem value="d" className="focus:bg-[#1f3b7a]">Grade D</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e2038] border-[#223351] text-white">
                    <SelectItem value="containerCode" className="focus:bg-[#1f3b7a]">Container Number</SelectItem>
                    <SelectItem value="status" className="focus:bg-[#1f3b7a]">Status</SelectItem>
                    <SelectItem value="location" className="focus:bg-[#1f3b7a]">Location</SelectItem>
                    <SelectItem value="grade" className="focus:bg-[#1f3b7a]">Grade</SelectItem>
                    <SelectItem value="yom" className="focus:bg-[#1f3b7a]">Year of Manufacture</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="flex items-center gap-2 border-[#223351] text-white hover:bg-[#13233d]">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Container Table */}
          <Card className="bg-[#0c1a2e] border-[#223351]">
            <CardHeader>
              <CardTitle className="text-white">Container Master Sheet ({filteredAndSortedContainers.length} containers)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#223351]">
                    <tr>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Container Number</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Product Type</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Size</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Size Type</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Group Name</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">GKU Product Name</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Category</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Location</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Depot</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">YOM</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Current</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Grade</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Reefer Unit</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Reefer Unit Model</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Health Score</th>
                      <th className="text-left py-3 px-2 font-medium text-white/80">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedContainers.map((container: Container) => {
                      const metadata = container.excelMetadata || {};
                      return (
                        <tr 
                          key={container.id} 
                          className="border-b border-[#223351] hover:bg-[#13233d] cursor-pointer"
                          onClick={() => setLocation(`/containers/${container.id}`)}
                        >
                          <td className="py-3 px-2 font-mono text-xs font-medium text-white">{container.containerCode}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.productType || container.type}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.size || container.capacity}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.sizeType || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.groupName || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.gkuProductName || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.category || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.location || 'Unknown'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.depot || 'Unknown'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.yom || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getStatusBadge(metadata.status || container.status)}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.current || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getGradeBadge(metadata.grade || 'N/A')}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.reeferUnit || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs text-white">{metadata.reeferUnitModel || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getHealthScoreBadge(container.healthScore || 0)}</td>
                          <td className="py-3 px-2 text-xs">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-white hover:bg-[#1f3b7a]"
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
