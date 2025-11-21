// Service Request Detail Page - Reformed UI with complete client info
// PDF Generation Feature Added
import { useRoute, Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  MapPin,
  Package,
  UserCheck,
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Image as ImageIcon,
  Video,
  FileText,
  Wrench,
  Plus,
  Minus,
  Box,
  FileDown
} from "lucide-react";
import { useState } from "react";
import { generateServiceRequestPDF } from "@/lib/pdfGenerator";

interface InventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  category: string;
  quantityInStock: number;
  reorderLevel: number;
  unitPrice: number;
  location: string;
}

export default function ServiceRequestDetail() {
  const [, params] = useRoute("/service-requests/:id");
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false);
  const [selectedParts, setSelectedParts] = useState<{ itemId: string; quantity: number; partName: string }[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/service-requests", id],
    queryFn: async () => (await apiRequest("GET", `/api/service-requests/${id}`)).json(),
  });

  const { data: whatsappMessages } = useQuery({
    queryKey: ["/api/service-requests", id, "whatsapp-messages"],
    queryFn: async () => (await apiRequest("GET", `/api/service-requests/${id}/whatsapp-messages`)).json(),
    enabled: !!id,
  });

  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => (await apiRequest("GET", "/api/inventory")).json(),
    enabled: isInventoryDialogOpen,
  });

  const addPart = () => {
    if (!selectedItemId) return;
    const item = inventory?.find((i: InventoryItem) => i.id === selectedItemId);
    if (!item) return;

    // Check if part already added
    const existingIndex = selectedParts.findIndex(p => p.itemId === selectedItemId);
    if (existingIndex >= 0) {
      const updated = [...selectedParts];
      updated[existingIndex].quantity += selectedQuantity;
      setSelectedParts(updated);
    } else {
      setSelectedParts([...selectedParts, {
        itemId: selectedItemId,
        quantity: selectedQuantity,
        partName: item.partName
      }]);
    }
    setSelectedItemId("");
    setSelectedQuantity(1);
  };

  const removePart = (itemId: string) => {
    setSelectedParts(selectedParts.filter(p => p.itemId !== itemId));
  };

  const updatePartQuantity = (itemId: string, change: number) => {
    setSelectedParts(selectedParts.map(p => {
      if (p.itemId === itemId) {
        const newQty = Math.max(1, p.quantity + change);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const saveParts = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/service-requests/${id}`, {
        requiredParts: selectedParts.map(p => `${p.partName} (${p.quantity})`)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", id] });
      setIsInventoryDialogOpen(false);
      toast({
        title: "Success",
        description: "Required parts updated successfully",
      });
    },
  });

  const raiseIndent = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/service-requests/${id}/raise-indent`, {
        parts: selectedParts.map(p => ({
          itemId: p.itemId,
          partName: p.partName,
          quantity: p.quantity
        }))
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", id] });
      setIsInventoryDialogOpen(false);
      setSelectedParts([]);
      toast({
        title: "Indent Raised Successfully",
        description: `Indent ${response.indentNumber} created with ${selectedParts.length} items`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to raise indent",
        variant: "destructive",
      });
    },
  });

  const raiseIndentFromParts = useMutation({
    mutationFn: async () => {
      if (!data?.requiredParts || data.requiredParts.length === 0) {
        throw new Error("No parts available to create indent");
      }

      // Parse required parts strings to extract part names and quantities
      const partsData = data.requiredParts.map((partStr: string) => {
        // Extract part name and quantity from format "Part Name (quantity)"
        const match = partStr.match(/^(.+?)\s*\((\d+)\)$/);
        if (match) {
          return {
            partName: match[1].trim(),
            quantity: parseInt(match[2])
          };
        }
        // If no quantity specified, default to 1
        return {
          partName: partStr.trim(),
          quantity: 1
        };
      });

      return await apiRequest("POST", `/api/service-requests/${id}/raise-indent-from-parts`, {
        parts: partsData
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", id] });
      toast({
        title: "Indent Raised Successfully",
        description: `Indent ${response.indentNumber} created with ${response.itemCount} items`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to raise indent",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Service Request" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Service Request" />
          <div className="p-6">
            <Link to="/service-requests" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" /> Back to list
            </Link>
            <p className="mt-4 text-sm text-red-600">Failed to load service request.</p>
          </div>
        </main>
      </div>
    );
  }

  const req = data as any;
  const customer = req.customer || {};
  const container = req.container || {};
  const technician = req.technician || {};
  const user = customer.user || {};

  // Debug: Log allContainers to console
  if (data && (data as any).allContainers) {
    console.log('[FRONTEND] allContainers received:', (data as any).allContainers);
    console.log('[FRONTEND] allContainers length:', (data as any).allContainers.length);
  } else {
    console.warn('[FRONTEND] allContainers not found in data:', data);
  }

  // PDF Generation Handler
  const handleGeneratePDF = async () => {
    toast({
      title: "Generating PDF",
      description: "Please wait while we generate your PDF...",
    });

    try {
      // Helper function to convert media URLs
      const getMediaUrls = (mediaArray: any[]) => {
        if (!mediaArray || !Array.isArray(mediaArray)) return [];
        return mediaArray.map(id => {
          // Handle both full URLs and IDs
          if (typeof id === 'string') {
            if (id.startsWith('http')) return id;
            if (id.startsWith('wa:')) return `/api/whatsapp/media/${id}`;
            return `/api/whatsapp/media/${id}`;
          }
          return '';
        }).filter(url => url);
      };

      const pdfData = {
        id: req.id,
        requestNumber: req.requestNumber,
        status: req.status,
        priority: req.priority,
        issueDescription: req.issueDescription,
        createdAt: req.createdAt,
        scheduledDate: req.scheduledDate,
        completedAt: req.completedAt,
        estimatedDuration: req.estimatedDuration,
        actualDuration: req.actualDuration,
        serviceType: req.serviceType,
        urgency: req.urgency,
        customer: (customer.contactPerson || customer.companyName || customer.name) ? {
          name: customer.name,
          contactPerson: customer.contactPerson || user.name,
          email: customer.email || user.email,
          phone: customer.phone || user.phoneNumber,
          whatsappNumber: customer.whatsappNumber,
          company: customer.company,
          companyName: customer.companyName,
          address: customer.address,
          billingAddress: customer.billingAddress,
          shippingAddress: customer.shippingAddress,
          customerTier: customer.customerTier,
          gstin: customer.gstin,
          paymentTerms: customer.paymentTerms,
          status: customer.status,
        } : undefined,
        technician: technician.name ? {
          name: technician.name,
          phone: technician.phone,
          email: technician.email,
          specialization: technician.specialization,
        } : undefined,
        containers: (data as any).allContainers?.map((c: any) => ({
          containerCode: c.containerCode,
          location: c.location,
          type: c.type,
          status: c.status,
        })),
        requiredParts: req.requiredParts,
        diagnosis: req.diagnosis,
        resolution: req.resolution,
        workPerformed: req.workPerformed,
        comments: req.comments,
        totalCost: req.totalCost,
        laborCost: req.laborCost,
        partsCost: req.partsCost,
        clientUploadedPhotos: getMediaUrls(req.clientUploadedPhotos),
        beforePhotos: getMediaUrls(req.beforePhotos),
        afterPhotos: getMediaUrls(req.afterPhotos),
      };

      await generateServiceRequestPDF(pdfData);

      toast({
        title: "PDF Generated Successfully",
        description: `Service request ${req.requestNumber} has been downloaded as PDF`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error Generating PDF",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'scheduled': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'approved': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Priority badge color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Build timeline events
  const timelineEvents = [];
  if (req.requestedAt) {
    timelineEvents.push({
      label: 'Requested',
      timestamp: req.requestedAt,
      icon: AlertCircle,
      color: 'text-blue-600'
    });
  }
  if (req.approvedAt) {
    timelineEvents.push({
      label: 'Approved',
      timestamp: req.approvedAt,
      icon: CheckCircle2,
      color: 'text-green-600'
    });
  }
  if (req.scheduledDate) {
    timelineEvents.push({
      label: 'Scheduled',
      timestamp: req.scheduledDate,
      icon: Calendar,
      color: 'text-purple-600'
    });
  }
  if (req.actualStartTime) {
    timelineEvents.push({
      label: 'Started',
      timestamp: req.actualStartTime,
      icon: Clock,
      color: 'text-orange-600'
    });
  }
  if (req.actualEndTime) {
    timelineEvents.push({
      label: 'Completed',
      timestamp: req.actualEndTime,
      icon: CheckCircle2,
      color: 'text-green-600'
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Request Details" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link to="/service-requests" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" /> Back to Service Requests
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleGeneratePDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Generate PDF
              </Button>
              <Badge className={getStatusColor(req.status)}>{req.status}</Badge>
              <Badge className={getPriorityColor(req.priority)}>{req.priority}</Badge>
            </div>
          </div>

          {/* Request Number and Basic Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">{req.requestNumber}</CardTitle>
                  <CardDescription className="mt-1">
                    {req.issueDescription}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="client">Client Info</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="conversation">Conversation</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Container Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Container Details {((data as any)?.allContainers?.length || 0) > 1 && (
                        <Badge variant="secondary" className="ml-2">{(data as any).allContainers.length} Containers</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const allContainers = (data as any)?.allContainers || [];
                      console.log('[FRONTEND] Rendering containers, count:', allContainers.length, allContainers);
                      return allContainers.length > 0 ? (
                        allContainers.map((cont: any, index: number) => (
                        <div key={cont.id || index}>
                          {index > 0 && <Separator className="my-3" />}
                          {allContainers.length > 1 && (
                            <div className="flex items-center gap-2 mb-2">
                              <Box className="w-4 h-4" />
                              <span className="font-medium text-sm">Container {index + 1}</span>
                              {index === 0 && <Badge variant="outline" className="text-xs">Primary</Badge>}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Container Code</p>
                              <p className="font-mono font-medium">{cont.containerCode || "-"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Type</p>
                              <p className="font-medium capitalize">{cont.type || "-"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              <Badge variant="outline">{cont.status || "-"}</Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground">IoT Enabled</p>
                              <p className="font-medium">{cont.iotEnabled ? "Yes" : "No"}</p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-muted-foreground text-sm mb-1">Current Location</p>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <p className="text-sm">{cont.currentLocation?.address || "Location not available"}</p>
                            </div>
                          </div>
                        </div>
                      ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No container information available</p>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Technician Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5" />
                      Assigned Technician
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {technician.id ? (
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Name</p>
                          <p className="font-medium">{technician.user?.name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Employee Code</p>
                          <p className="font-mono">{technician.employeeCode || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Experience Level</p>
                          <p className="font-medium capitalize">{technician.experienceLevel || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Contact</p>
                          <p className="font-medium">{technician.user?.phoneNumber || "N/A"}</p>
                        </div>
                        {technician.skills && technician.skills.length > 0 && (
                          <div>
                            <p className="text-muted-foreground mb-2">Skills</p>
                            <div className="flex flex-wrap gap-1">
                              {technician.skills.map((skill: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No technician assigned yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Service Schedule & Duration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Schedule & Duration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-muted-foreground">Scheduled Date</p>
                        <p className="font-medium">
                          {req.scheduledDate ? new Date(req.scheduledDate).toLocaleDateString() : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Time Window</p>
                        <p className="font-medium">{req.scheduledTimeWindow || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Actual Start</p>
                        <p className="font-medium">
                          {req.actualStartTime ? new Date(req.actualStartTime).toLocaleString() : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Actual End</p>
                        <p className="font-medium">
                          {req.actualEndTime ? new Date(req.actualEndTime).toLocaleString() : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium">
                          {req.durationMinutes ? `${req.durationMinutes} minutes` : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Required Parts / Inventory */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5" />
                        Required Parts / Spares
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            if (req.requiredParts && req.requiredParts.length > 0) {
                              // Request indent from existing required parts
                              raiseIndentFromParts.mutate();
                            } else {
                              // No parts available, prompt to add parts first
                              toast({
                                title: "No Parts Available",
                                description: "Please add parts using 'Manage Parts' before requesting an indent",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={raiseIndentFromParts.isPending || !req?.requiredParts || req.requiredParts?.length === 0}
                        >
                          {raiseIndentFromParts.isPending ? "Requesting..." : "Request Indent"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsInventoryDialogOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Manage Parts
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {req.requiredParts && req.requiredParts.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {req.requiredParts.map((part: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Box className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <span>{part}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No parts specified</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Resolution Notes */}
              {req.resolutionNotes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Service Notes / Resolution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border">
                      {req.resolutionNotes}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Client Info Tab */}
            <TabsContent value="client" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <User className="w-4 h-4" />
                        <span>Contact Person</span>
                      </div>
                      <p className="font-medium">{customer.contactPerson || user.name || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Building2 className="w-4 h-4" />
                        <span>Company Name</span>
                      </div>
                      <p className="font-medium">{customer.companyName || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Phone className="w-4 h-4" />
                        <span>Phone Number</span>
                      </div>
                      <p className="font-medium font-mono">{customer.phone || user.phoneNumber || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <MessageSquare className="w-4 h-4" />
                        <span>WhatsApp Number</span>
                      </div>
                      <p className="font-medium font-mono">{customer.whatsappNumber || user.phoneNumber || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Mail className="w-4 h-4" />
                        <span>Email</span>
                      </div>
                      <p className="font-medium">{customer.email || user.email || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Package className="w-4 h-4" />
                        <span>Customer Tier</span>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {customer.customerTier || "standard"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Billing Address</p>
                      <p className="text-sm">{customer.billingAddress || "-"}</p>
                    </div>
                    {customer.shippingAddress && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Shipping Address</p>
                        <p className="text-sm">{customer.shippingAddress}</p>
                      </div>
                    )}
                    {customer.gstin && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">GSTIN</p>
                        <p className="text-sm font-mono">{customer.gstin}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Payment Terms</p>
                      <Badge variant="secondary">{customer.paymentTerms || "net30"}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Customer Status</p>
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status || "active"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="space-y-6">
              {/* Client Uploaded Media Section */}
              {((Array.isArray(req.clientUploadedPhotos) && req.clientUploadedPhotos.length > 0) ||
                (Array.isArray(req.clientUploadedVideos) && req.clientUploadedVideos.length > 0)) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      Client Submitted Media
                    </CardTitle>
                    <CardDescription>Media uploaded by client during service request creation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Photos ({req.clientUploadedPhotos?.length || 0})</p>
                        <div className="grid grid-cols-2 gap-3">
                          {Array.isArray(req.clientUploadedPhotos) && req.clientUploadedPhotos.length > 0 ? (
                            req.clientUploadedPhotos.map((ref: string, idx: number) => {
                              const mediaRef = ref && !ref.startsWith('wa:') ? `wa:${ref}` : ref;
                              return (
                                <a key={`cp-${idx}`} className="block aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors" href={`/api/whatsapp/media/${encodeURIComponent(mediaRef)}`} target="_blank" rel="noreferrer">
                                  <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(mediaRef)}`} alt={`Client photo ${idx + 1}`} onError={(e) => {
                                    console.error('Failed to load image:', mediaRef);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }} />
                                </a>
                              );
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground col-span-2">No photos</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Videos ({req.clientUploadedVideos?.length || 0})</p>
                        <div className="space-y-3">
                          {Array.isArray(req.clientUploadedVideos) && req.clientUploadedVideos.length > 0 ? (
                            req.clientUploadedVideos.map((ref: string, idx: number) => {
                              const mediaRef = ref && !ref.startsWith('wa:') ? `wa:${ref}` : ref;
                              return (
                                <a key={`cv-${idx}`} className="block aspect-video bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors" href={`/api/whatsapp/media/${encodeURIComponent(mediaRef)}`} target="_blank" rel="noreferrer">
                                  <video className="w-full h-full object-cover" controls>
                                    <source src={`/api/whatsapp/media/${encodeURIComponent(mediaRef)}`} type="video/mp4" />
                                    Client Video {idx + 1}
                                  </video>
                                </a>
                              );
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">No videos</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Technician Photos Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    Technician Service Photos
                  </CardTitle>
                  <CardDescription>Photos captured by technician during service</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Before Service ({req.beforePhotos?.length || 0})</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(req.beforePhotos || []).length > 0 ? (
                          req.beforePhotos.map((ref: string, idx: number) => (
                            <a key={`b-${idx}`} className="block aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors" href={`/api/whatsapp/media/${encodeURIComponent(ref)}`} target="_blank" rel="noreferrer">
                              <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(ref)}`} alt={`Before photo ${idx + 1}`} />
                            </a>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground col-span-2">No photos</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">After Service ({req.afterPhotos?.length || 0})</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(req.afterPhotos || []).length > 0 ? (
                          req.afterPhotos.map((ref: string, idx: number) => (
                            <a key={`a-${idx}`} className="block aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors" href={`/api/whatsapp/media/${encodeURIComponent(ref)}`} target="_blank" rel="noreferrer">
                              <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(ref)}`} alt={`After photo ${idx + 1}`} />
                            </a>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground col-span-2">No photos</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents */}
              {(req.signedDocumentUrl || req.vendorInvoiceUrl) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Service Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {req.signedDocumentUrl && (
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm font-medium">Client Signed Document</span>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={req.signedDocumentUrl} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        </div>
                      )}
                      {req.vendorInvoiceUrl && (
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm font-medium">Vendor Invoice</span>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={req.vendorInvoiceUrl} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Conversation Tab */}
            <TabsContent value="conversation" className="space-y-6">
              {whatsappMessages && whatsappMessages.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      WhatsApp Conversation ({whatsappMessages.length} messages)
                    </CardTitle>
                    <CardDescription>Complete WhatsApp conversation history related to this service request</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto bg-muted/20 rounded-lg p-4">
                      {whatsappMessages.map((msg: any, idx: number) => {
                        const content = msg.messageContent || {};
                        const isImage = content.type === 'image' || (content.image && content.image.id);
                        const isVideo = content.type === 'video' || (content.video && content.video.id);
                        const isText = content.type === 'text' || content.body;

                        return (
                          <div key={msg.id || idx} className="bg-background rounded-lg p-4 shadow-sm border">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={msg.recipientType === 'client' ? 'default' : 'secondary'}>
                                  {msg.recipientType === 'client' ? 'Client' : 'Technician'}
                                </Badge>
                                <span className="text-xs font-mono text-muted-foreground">{msg.phoneNumber}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(msg.sentAt).toLocaleString()}
                              </span>
                            </div>

                            {isText && (
                              <p className="text-sm leading-relaxed">{content.body || content.text?.body || 'No message'}</p>
                            )}

                            {isImage && (
                              <div className="mt-3">
                                <a href={`/api/whatsapp/media/${encodeURIComponent(content.image.id)}`} target="_blank" rel="noreferrer" className="block">
                                  <img
                                    src={`/api/whatsapp/media/${encodeURIComponent(content.image.id)}`}
                                    alt="WhatsApp image"
                                    className="max-w-sm rounded-lg border hover:border-primary transition-colors"
                                  />
                                </a>
                                {content.image.caption && <p className="text-sm mt-2 text-muted-foreground">{content.image.caption}</p>}
                              </div>
                            )}

                            {isVideo && (
                              <div className="mt-3">
                                <a href={`/api/whatsapp/media/${encodeURIComponent(content.video.id)}`} target="_blank" rel="noreferrer" className="block">
                                  <video controls className="max-w-sm rounded-lg border">
                                    <source src={`/api/whatsapp/media/${encodeURIComponent(content.video.id)}`} type="video/mp4" />
                                    Video message
                                  </video>
                                </a>
                                {content.video.caption && <p className="text-sm mt-2 text-muted-foreground">{content.video.caption}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No WhatsApp conversation available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Service Request Timeline
                  </CardTitle>
                  <CardDescription>Complete chronological history of this service request</CardDescription>
                </CardHeader>
                <CardContent>
                  {timelineEvents.length > 0 ? (
                    <div className="space-y-4">
                      {timelineEvents.map((event, idx) => {
                        const Icon = event.icon;
                        return (
                          <div key={idx} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${event.color}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              {idx < timelineEvents.length - 1 && (
                                <div className="w-0.5 h-full bg-muted my-2"></div>
                              )}
                            </div>
                            <div className="flex-1 pb-6">
                              <p className="font-medium">{event.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(event.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No timeline events available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Inventory Dialog */}
      <Dialog open={isInventoryDialogOpen} onOpenChange={setIsInventoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Required Parts</DialogTitle>
            <DialogDescription>
              Select parts and quantities needed for this service request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Part Section */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="part-select">Select Part</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger id="part-select">
                    <SelectValue placeholder="Choose a part..." />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory?.map((item: InventoryItem) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.partName} ({item.partNumber}) - Stock: {item.quantityInStock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addPart} disabled={!selectedItemId}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            {/* Selected Parts List */}
            <div>
              <Label>Selected Parts ({selectedParts.length})</Label>
              {selectedParts.length > 0 ? (
                <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                  {selectedParts.map((part) => (
                    <div key={part.itemId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{part.partName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updatePartQuantity(part.itemId, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{part.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updatePartQuantity(part.itemId, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removePart(part.itemId)}
                        >
                          <XCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No parts selected</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsInventoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => raiseIndent.mutate()}
              disabled={raiseIndent.isPending || selectedParts.length === 0}
            >
              {raiseIndent.isPending ? "Creating Indent..." : "Raise Indent"}
            </Button>
            <Button onClick={() => saveParts.mutate()} disabled={saveParts.isPending}>
              {saveParts.isPending ? "Saving..." : "Save Parts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
