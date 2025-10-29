import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import ContainerMap from "@/components/container-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Package, 
  Zap, 
  Settings, 
  Image as ImageIcon,
  ExternalLink,
  Download,
  Share2,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  Thermometer,
  Battery,
  Wifi,
  Truck,
  Copy,
  FileText
} from "lucide-react";

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
  currentCustomerId?: string;
  customer?: {
    id: string;
    companyName: string;
    contactPerson: string;
    phone?: string;
    email?: string;
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
  manufacturingDate?: string;
  purchaseDate?: string;
  lastSyncTime?: string;
  usageCycles?: number;
  orbcommDeviceId?: string;
  hasIot: boolean;
}

export default function ContainerDetail() {
  const [, params] = useRoute("/containers/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const authToken = getAuthToken();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const { data: container, isLoading, error } = useQuery({
    queryKey: [`/api/containers/${id}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/containers/${id}`);
      return response.json();
    },
    enabled: !!id,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Fetch customer data if container has currentCustomerId
  const { data: customer, isLoading: customerLoading, error: customerError } = useQuery({
    queryKey: [`/api/customers/${container?.currentCustomerId}`],
    queryFn: async () => {
      if (!container?.currentCustomerId) return null;
      const response = await apiRequest("GET", `/api/customers/${container.currentCustomerId}`);
      if (!response.ok) return null; // Don't throw error, just return null
      return response.json();
    },
    enabled: !!container?.currentCustomerId && !!container,
    retry: 1,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      "DEPLOYED": { color: "bg-green-100 text-green-800 border-green-200", label: "Deployed", icon: CheckCircle },
      "SALE": { color: "bg-blue-100 text-blue-800 border-blue-200", label: "For Sale", icon: Package },
      "MAINTENANCE": { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Maintenance", icon: Settings },
      "STOCK": { color: "bg-gray-100 text-gray-800 border-gray-200", label: "In Stock", icon: Package },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || { 
      color: "bg-gray-100 text-gray-800 border-gray-200", 
      label: status, 
      icon: Package 
    };
    const IconComponent = statusInfo.icon;
    return (
      <Badge className={`${statusInfo.color} border flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  const getGradeBadge = (grade: string) => {
    const gradeMap = {
      "A": { color: "bg-green-100 text-green-800 border-green-200", label: "A - Excellent" },
      "B": { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "B - Good" },
      "C": { color: "bg-red-100 text-red-800 border-red-200", label: "C - Fair" },
      "D": { color: "bg-red-100 text-red-800 border-red-200", label: "D - Poor" },
    };
    const gradeInfo = gradeMap[grade as keyof typeof gradeMap] || { 
      color: "bg-gray-100 text-gray-800 border-gray-200", 
      label: grade 
    };
    return <Badge className={`${gradeInfo.color} border`}>{gradeInfo.label}</Badge>;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Poor";
  };

  // Handler functions for buttons
  const handleEdit = () => {
    console.log('Edit button clicked');
    setIsEditDialogOpen(true);
  };

  const handleShare = () => {
    console.log('Share button clicked');
    setIsShareDialogOpen(true);
  };

  const handleExport = async () => {
    console.log('Export button clicked');
    if (!container) return;
    
    setIsExporting(true);
    try {
      const metadata = container.excelMetadata || {};
      
      // Create CSV content
      const csvContent = [
        "Container Number,Product Type,Size,Size Type,Group Name,GKU Product Name,Category,Location,Depot,YOM,Status,Current,Grade,Reefer Unit,Reefer Unit Model,Health Score",
        `"${container.containerCode}","${metadata.productType || container.type}","${metadata.size || container.capacity}","${metadata.sizeType || 'N/A'}","${metadata.groupName || 'N/A'}","${metadata.gkuProductName || 'N/A'}","${metadata.category || 'N/A'}","${metadata.location || 'Unknown'}","${metadata.depot || 'Unknown'}","${metadata.yom || 'N/A'}","${metadata.status || container.status}","${metadata.current || 'N/A'}","${metadata.grade || 'N/A'}","${metadata.reeferUnit || 'N/A'}","${metadata.reeferUnitModel || 'N/A'}","${container.healthScore || 'N/A'}"`
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `container-${container.containerCode}-details.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Container ${container.containerCode} details exported successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export container details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied",
        description: "Container link copied to clipboard.",
      });
    });
  };

  const handleShareEmail = () => {
    const subject = `Container Details - ${container?.containerCode}`;
    const body = `Please find the details for container ${container?.containerCode}:\n\n${window.location.href}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Container Details" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading container details...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !container) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Container Details" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Container Not Found</h2>
              <p className="text-muted-foreground mb-4">The container you're looking for doesn't exist or has been removed.</p>
              <Button onClick={() => setLocation('/containers')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Containers
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const metadata = container.excelMetadata || {};

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Container Details" />
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLocation('/containers')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Containers
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <h1 className="text-2xl font-bold font-mono">{container.containerCode}</h1>
                {getStatusBadge(metadata.status || container.status)}
              </div>
              <div className="flex items-center gap-2">
                {customer && !customerError && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setLocation(`/clients/${customer.id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Client
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Edit button clicked - inline handler');
                    handleEdit();
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Share button clicked - inline handler');
                    handleShare();
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Export button clicked - inline handler');
                    handleExport();
                  }}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthScoreColor(container.healthScore || 0)}`}>
                  {container.healthScore || 0}
                </div>
                <p className="text-xs text-muted-foreground">{getHealthScoreLabel(container.healthScore || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Grade</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadata.grade || 'N/A'}</div>
                <p className="text-xs text-muted-foreground">Quality rating</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Year of Manufacture</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadata.yom || 'N/A'}</div>
                <p className="text-xs text-muted-foreground">Manufacturing year</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IoT Enabled</CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{container.hasIot ? 'Yes' : 'No'}</div>
                <p className="text-xs text-muted-foreground">Smart monitoring</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="location">Location & History</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Container Number</label>
                        <p className="font-mono text-sm">{container.containerCode}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Product Type</label>
                        <p className="text-sm">{metadata.productType || container.type}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Size</label>
                        <p className="text-sm">{metadata.size || container.capacity}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Size Type</label>
                        <p className="text-sm">{metadata.sizeType || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Group Name</label>
                        <p className="text-sm">{metadata.groupName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">GKU Product Name</label>
                        <p className="text-sm">{metadata.gkuProductName || 'N/A'}</p>
                      </div>
                      {customer && !customerError && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Current Owner</label>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{customer.companyName}</p>
                              <Button
                                variant="outline"
                                size="xs"
                                className="h-6 px-2"
                                onClick={() => setLocation(`/clients/${customer.id}`)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Profile
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                            <p className="text-sm">{customer.contactPerson}</p>
                          </div>
                          {customer.phone && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Phone</label>
                              <p className="text-sm">{customer.phone}</p>
                            </div>
                          )}
                          {customer.email && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Email</label>
                              <p className="text-sm">{customer.email}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Status & Condition */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Status & Condition
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Current Status</label>
                        <div className="mt-1">{getStatusBadge(metadata.status || container.status)}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Current State</label>
                        <p className="text-sm">{metadata.current || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Category</label>
                        <p className="text-sm">{metadata.category || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Grade</label>
                        <div className="mt-1">{getGradeBadge(metadata.grade || 'N/A')}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Health Score</label>
                        <div className="flex items-center gap-2">
                          <div className={`text-lg font-bold ${getHealthScoreColor(container.healthScore || 0)}`}>
                            {container.healthScore || 0}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {getHealthScoreLabel(container.healthScore || 0)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Usage Cycles</label>
                        <p className="text-sm">{container.usageCycles || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Images Section */}
              {metadata.imageLinks && metadata.imageLinks !== 'NA' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Container Images
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" asChild>
                        <a href={metadata.imageLinks} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Images
                        </a>
                      </Button>
                      <span className="text-sm text-muted-foreground">Google Drive Link</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Specifications Tab */}
            <TabsContent value="specifications" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Physical Specifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Physical Specifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Size</label>
                        <p className="text-sm">{metadata.size || container.capacity}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Size Type</label>
                        <p className="text-sm">{metadata.sizeType || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Group Name</label>
                        <p className="text-sm">{metadata.groupName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">GKU Product Name</label>
                        <p className="text-sm">{metadata.gkuProductName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Category</label>
                        <p className="text-sm">{metadata.category || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Year of Manufacture</label>
                        <p className="text-sm">{metadata.yom || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reefer Specifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5" />
                      Reefer Specifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Reefer Unit</label>
                        <p className="text-sm">{metadata.reeferUnit || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Reefer Unit Model</label>
                        <p className="text-sm">{metadata.reeferUnitModel || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">IoT Device ID</label>
                        <p className="text-sm font-mono">{container.orbcommDeviceId || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">IoT Enabled</label>
                        <p className="text-sm">{container.hasIot ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Location & History Tab */}
            <TabsContent value="location" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Location */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Current Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Location</label>
                        <p className="text-sm">{metadata.location || 'Unknown'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Depot</label>
                        <p className="text-sm">{metadata.depot || 'Unknown'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Sync</label>
                        <p className="text-sm">
                          {container.lastSyncTime ? new Date(container.lastSyncTime).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ContainerMap 
                  location={metadata.location}
                  depot={metadata.depot}
                  containerCode={container.containerCode}
                />

                {/* Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium">Manufactured</p>
                          <p className="text-xs text-muted-foreground">{metadata.yom || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium">Current Status</p>
                          <p className="text-xs text-muted-foreground">{metadata.status || container.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium">Last Updated</p>
                          <p className="text-xs text-muted-foreground">
                            {container.lastSyncTime ? new Date(container.lastSyncTime).toLocaleString() : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Maintenance Tab */}
            <TabsContent value="maintenance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Maintenance Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Maintenance Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Health Score</label>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`text-lg font-bold ${getHealthScoreColor(container.healthScore || 0)}`}>
                            {container.healthScore || 0}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {getHealthScoreLabel(container.healthScore || 0)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Grade</label>
                        <div className="mt-1">{getGradeBadge(metadata.grade || 'N/A')}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Usage Cycles</label>
                        <p className="text-sm">{container.usageCycles || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Maintenance Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Maintenance Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Button className="w-full justify-start" variant="outline">
                        <Settings className="h-4 w-4 mr-2" />
                        Schedule Maintenance
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Report Issue
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <Package className="h-4 w-4 mr-2" />
                        Request Parts
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Container - {container?.containerCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="containerCode">Container Code</Label>
                <Input 
                  id="containerCode" 
                  defaultValue={container?.containerCode} 
                  disabled 
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select defaultValue={metadata.status || container?.status}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPLOYED">Deployed</SelectItem>
                    <SelectItem value="SALE">For Sale</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="STORAGE">Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input 
                  id="location" 
                  defaultValue={metadata.location || 'Unknown'} 
                />
              </div>
              <div>
                <Label htmlFor="depot">Depot</Label>
                <Input 
                  id="depot" 
                  defaultValue={metadata.depot || 'Unknown'} 
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Add any additional notes about this container..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast({
                  title: "Edit Saved",
                  description: "Container details updated successfully.",
                });
                setIsEditDialogOpen(false);
              }}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Container - {container?.containerCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input 
                  value={typeof window !== 'undefined' ? window.location.href : ''} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Share Options</Label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleShareEmail} className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
