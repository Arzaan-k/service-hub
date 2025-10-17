import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
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
  const [, setLocation] = useLocation();
  const authToken = getAuthToken();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("containerCode");

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ["/api/containers/all"],
    queryFn: async () => {
      const pageSize = 500;
      let offset = 0;
      let all: any[] = [];
      let total = Infinity;

      while (offset < total) {
        const res = await fetch(`/api/containers?limit=${pageSize}&offset=${offset}` , {
          headers: { "x-user-id": authToken || "" },
        });
        const chunk = await res.json();
        const hdr = res.headers.get('x-total-count');
        total = hdr ? parseInt(hdr, 10) : (offset + chunk.length);
        all = all.concat(chunk);
        if (chunk.length < pageSize) break;
        offset += pageSize;
      }

      return all;
    },
  });

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
      "DEPLOYED": { color: "bg-green-100 text-green-800", label: "Deployed" },
      "SALE": { color: "bg-blue-100 text-blue-800", label: "For Sale" },
      "SOLD": { color: "bg-red-100 text-red-800", label: "Sold" },
      "MAINTENANCE": { color: "bg-yellow-100 text-yellow-800", label: "Maintenance" },
      "STOCK": { color: "bg-gray-100 text-gray-800", label: "In Stock" },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || { color: "bg-gray-100 text-gray-800", label: status };
    return <Badge className={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  const getGradeBadge = (grade: string) => {
    const gradeMap = {
      "A": { color: "bg-green-100 text-green-800", label: "A" },
      "B": { color: "bg-yellow-100 text-yellow-800", label: "B" },
      "C": { color: "bg-red-100 text-red-800", label: "C" },
      "D": { color: "bg-red-100 text-red-800", label: "D" },
    };
    const gradeInfo = gradeMap[grade as keyof typeof gradeMap] || { color: "bg-gray-100 text-gray-800", label: grade };
    return <Badge className={gradeInfo.color}>{gradeInfo.label}</Badge>;
  };

  const getHealthScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    if (score >= 50) return <Badge className="bg-orange-100 text-orange-800">Fair</Badge>;
    return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Container Master Sheet" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading containers...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Container Master Sheet" />
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{containers.length}</div>
                <p className="text-xs text-muted-foreground">All containers</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deployed</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {containers.filter((c: Container) => c.excelMetadata?.status === "DEPLOYED").length}
                </div>
                <p className="text-xs text-muted-foreground">Active containers</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">For Sale</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {containers.filter((c: Container) => c.excelMetadata?.status === "SALE").length}
                </div>
                <p className="text-xs text-muted-foreground">Available for sale</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
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
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
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
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                    <SelectItem value="dry">Dry</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Container Table */}
          <Card>
            <CardHeader>
              <CardTitle>Container Master Sheet ({filteredAndSortedContainers.length} containers)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Container Number</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Product Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Size</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Size Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Group Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">GKU Product Name</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Category</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Location</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Depot</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">YOM</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Current</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Grade</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reefer Unit</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reefer Unit Model</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Health Score</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedContainers.map((container: Container) => {
                      const metadata = container.excelMetadata || {};
                      return (
                        <tr 
                          key={container.id} 
                          className="border-b border-border hover:bg-muted/10 cursor-pointer"
                          onClick={() => setLocation(`/containers/${container.id}`)}
                        >
                          <td className="py-3 px-2 font-mono text-xs font-medium">{container.containerCode}</td>
                          <td className="py-3 px-2 text-xs">{metadata.productType || container.type}</td>
                          <td className="py-3 px-2 text-xs">{metadata.size || container.capacity}</td>
                          <td className="py-3 px-2 text-xs">{metadata.sizeType || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.groupName || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.gkuProductName || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.category || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.location || 'Unknown'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.depot || 'Unknown'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.yom || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getStatusBadge(metadata.status || container.status)}</td>
                          <td className="py-3 px-2 text-xs">{metadata.current || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getGradeBadge(metadata.grade || 'N/A')}</td>
                          <td className="py-3 px-2 text-xs">{metadata.reeferUnit || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{metadata.reeferUnitModel || 'N/A'}</td>
                          <td className="py-3 px-2 text-xs">{getHealthScoreBadge(container.healthScore || 0)}</td>
                          <td className="py-3 px-2 text-xs">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
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
