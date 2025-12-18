import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  PlayCircle,
  UserCheck,
  UserCog,
  FileText,
  Send,
  AlertCircle,
  Package,
  Calendar,
  MapPin,
} from "lucide-react";

interface ServiceRequest {
  id: string;
  requestNumber: string;
  status: string;
  priority: string;
  issueDescription: string;
  assignedTechnicianId?: string | null;
  beforePhotos?: string[];
  afterPhotos?: string[];
  resolutionNotes?: string;
  container?: {
    id: string;
    containerCode: string;
    currentLocation: any;
  };
  customer?: {
    id: string;
    companyName: string;
  };
  technician?: {
    id: string;
    name: string;
  };
  scheduledDate?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  createdAt: string;
  isDuplicate?: boolean;
  duplicateCount?: number;
}

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const getRequestId = (req: any): string => (req?.id || req?._id || "") as string;
  const [activeTab, setActiveTab] = useState("all");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newContainerId, setNewContainerId] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newIssue, setNewIssue] = useState("");
  const [newEstimatedDuration, setNewEstimatedDuration] = useState<string>("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignScheduledDate, setAssignScheduledDate] = useState<string>("");
  const [assignTimeWindow, setAssignTimeWindow] = useState<string>("");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [, setLocation] = useLocation();

  // Dropdown removed: direct navigation to assign page simplifies UX

  const { data: requests, isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests"],
    queryFn: async () => (await apiRequest("GET", "/api/service-requests")).json()
  });

  const { data: technicians } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
    queryFn: async () => (await apiRequest("GET", "/api/technicians")).json()
  });

  const { data: allContainers } = useQuery<any[]>({
    queryKey: ["/api/containers"],
    queryFn: async () => (await apiRequest("GET", "/api/containers")).json()
  });

  const { data: allCustomers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => (await apiRequest("GET", "/api/customers")).json()
  });

  // Dependent filtering: when container is selected, show only its customer; when customer selected, filter containers
  const customers = (() => {
    if (newContainerId && allContainers) {
      const selected = (allContainers as any[]).find((c) => c.id === newContainerId);
      console.log('[Service Request] Selected container:', selected);
      if (selected && selected.currentCustomerId) {
        const filtered = (allCustomers as any[] | undefined)?.filter((cust) => cust.id === selected.currentCustomerId);
        console.log('[Service Request] Filtered customers for container:', filtered);
        return filtered;
      }
    }
    return allCustomers;
  })();

  const containers = (() => {
    if (newCustomerId && allContainers) {
      const filtered = (allContainers as any[]).filter((c) => c.currentCustomerId === newCustomerId);
      console.log('[Service Request] Customer selected:', newCustomerId);
      console.log('[Service Request] Filtered containers for customer:', filtered);
      console.log('[Service Request] Sample container data:', allContainers?.[0]);
      return filtered;
    }
    return allContainers;
  })();

  const assignTechnician = useMutation({
    mutationFn: async ({ id, technicianId, scheduledDate, scheduledTimeWindow }: { id: string; technicianId: string; scheduledDate?: string; scheduledTimeWindow?: string }) => {
      return await apiRequest("POST", `/api/service-requests/${id}/assign`, { technicianId, scheduledDate, scheduledTimeWindow });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      setAssignDialogOpen(false);
      setSelectedRequest(null);
      setAssignScheduledDate("");
      setAssignTimeWindow("");
      toast({
        title: "Success",
        description: "Technician assigned successfully",
      });
    },
  });

  const startService = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/service-requests/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Service Started",
        description: "Service request has been marked as in progress",
      });
    },
  });

  const completeService = useMutation({
    mutationFn: async (data: { id: string; resolutionNotes: string }) => {
      return await apiRequest("POST", `/api/service-requests/${data.id}/complete`, {
        resolutionNotes: data.resolutionNotes,
        usedParts: [],
        beforePhotos: [],
        afterPhotos: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      setCompleteDialogOpen(false);
      setSelectedRequest(null);
      toast({
        title: "Service Completed",
        description: "Service request has been marked as completed",
      });
    },
  });

  const cancelService = useMutation({
    mutationFn: async (data: { id: string; reason: string }) => {
      return await apiRequest("POST", `/api/service-requests/${data.id}/cancel`, {
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      setCancelDialogOpen(false);
      setSelectedRequest(null);
      toast({
        title: "Service Cancelled",
        description: "Service request has been cancelled",
      });
    },
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!newContainerId || !newCustomerId || !newIssue) {
        throw new Error("Please fill all required fields");
      }
      return await apiRequest("POST", "/api/service-requests", {
        containerId: newContainerId,
        customerId: newCustomerId,
        priority: newPriority,
        issueDescription: newIssue,
        estimatedDuration: newEstimatedDuration ? Number(newEstimatedDuration) : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      setNewDialogOpen(false);
      setNewContainerId("");
      setNewCustomerId("");
      setNewPriority("normal");
      setNewIssue("");
      setNewEstimatedDuration("");
      toast({ title: "Created", description: "Service request created (auto-assignment attempted)" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message || "Could not create request", variant: "destructive" });
    }
  });

  const generateInvoice = useMutation({
    mutationFn: async (serviceRequestId: string) => {
      return await apiRequest("POST", "/api/invoicing/generate", { serviceRequestId });
    },
    onSuccess: () => {
      toast({
        title: "Invoice Generated",
        description: "Invoice has been generated successfully",
      });
    },
  });

  const handleAssign = () => {
    if (!selectedRequest || !selectedTechnicianId) return;
    assignTechnician.mutate({ id: selectedRequest.id, technicianId: selectedTechnicianId, scheduledDate: assignScheduledDate || undefined, scheduledTimeWindow: assignTimeWindow || undefined });
  };

  const handleComplete = () => {
    if (!selectedRequest) return;
    completeService.mutate({ id: selectedRequest.id, resolutionNotes: completionNotes });
  };

  // Direct assignment handled on dedicated page

  const handleCancel = () => {
    if (!selectedRequest) return;
    cancelService.mutate({ id: selectedRequest.id, reason: cancelReason });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      pending: { color: "bg-gray-500/20 text-gray-400 border-gray-400/30", icon: Clock },
      approved: { color: "bg-blue-500/20 text-blue-400 border-blue-400/30", icon: CheckCircle },
      scheduled: { color: "bg-purple-500/20 text-purple-400 border-purple-400/30", icon: Calendar },
      in_progress: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-400/30", icon: Play },
      completed: { color: "bg-green-500/20 text-green-400 border-green-400/30", icon: CheckCircle },
      cancelled: { color: "bg-red-500/20 text-red-400 border-red-400/30", icon: XCircle },
    };
    const config = statusMap[status] || statusMap.pending;
    const IconComponent = config.icon;
    return (
      <Badge className={`${config.color} border flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, string> = {
      urgent: "bg-red-500/20 text-red-400 border-red-400/30",
      high: "bg-orange-500/20 text-orange-400 border-orange-400/30",
      normal: "bg-blue-500/20 text-blue-400 border-blue-400/30",
      low: "bg-gray-500/20 text-gray-400 border-gray-400/30",
    };
    return priorityMap[priority] || priorityMap.normal;
  };

  const technicianLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(technicians)) {
      technicians.forEach((tech: any) => {
        const techId = tech?.id ?? tech?._id ?? tech?.technicianId;
        if (techId !== undefined && techId !== null) {
          map.set(String(techId), tech);
        }
      });
    }
    return map;
  }, [technicians]);

  const internalTechnicianIds = useMemo(() => {
    return new Set(Array.from(technicianLookup.keys()));
  }, [technicianLookup]);

  const technicianDirectoryLoaded = Array.isArray(technicians);

  const hasAssignedTechnician = (req: ServiceRequest): boolean => {
    const rawId = (req as any).assignedTechnicianId;
    const trimmed = typeof rawId === "string" ? rawId.trim() : rawId;
    const normalizedId = trimmed === undefined || trimmed === null ? "" : String(trimmed);

    if (normalizedId) {
      if (!technicianDirectoryLoaded) {
        // Avoid misclassifying while technicians are still loading.
        return true;
      }
      if (internalTechnicianIds.has(normalizedId)) {
        return true;
      }
    }

    // If backend already populated technician relation, respect it.
    return Boolean((req as any).technician);
  };

  const getAssignedTechnicianInfo = (req: ServiceRequest) => {
    if ((req as any).technician) {
      return {
        id: (req as any).technician.id,
        name: (req as any).technician.name || (req as any).technician.employeeCode || (req as any).technician.id,
        phone: (req as any).technician.phone || (req as any).technician.user?.phoneNumber || (req as any).technician.user?.email
      };
    }
    const rawId = (req as any).assignedTechnicianId;
    const trimmed = typeof rawId === "string" ? rawId.trim() : rawId;
    if (trimmed === undefined || trimmed === null) return null;
    const normalizedId = String(trimmed);
    const tech = technicianLookup.get(normalizedId);
    if (tech) {
      return {
        id: normalizedId,
        name: tech.name || tech.employeeCode || tech.whatsappName || normalizedId,
        phone: tech.phoneNumber || tech.phone || tech.whatsappNumber
      };
    }
    return null;
  };

  const filteredRequests = requests?.filter((req: ServiceRequest) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") {
      // Pending tab shows every request with no technician assigned, regardless of status.
      const hasNoTechnician = !hasAssignedTechnician(req);
      const status = (req.status || '').toLowerCase();
      return hasNoTechnician && 
             status !== "completed" && 
             status !== "cancelled";
    }
    if (activeTab === "scheduled") {
      // Scheduled tab only shows requests that are in scheduled status AND truly assigned.
      return req.status === "scheduled" && hasAssignedTechnician(req);
    }
    return req.status === activeTab;
  });

  // Calculate stats
  // Pending count: all unassigned requests (not completed/cancelled)
  const pendingCount = requests?.filter((r: ServiceRequest) => {
    const hasNoTechnician = !hasAssignedTechnician(r);
    const status = (r.status || '').toLowerCase();
    return hasNoTechnician && 
           status !== "completed" && 
           status !== "cancelled";
  }).length || 0;
  // Scheduled count: only requests that are scheduled AND have a technician assigned
  const scheduledCount = requests?.filter((r: ServiceRequest) => {
    return r.status === "scheduled" && hasAssignedTechnician(r);
  }).length || 0;
  const inProgressCount = requests?.filter((r: ServiceRequest) => r.status === "in_progress").length || 0;
  const completedCount = requests?.filter((r: ServiceRequest) => r.status === "completed").length || 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Service Requests" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Requests" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-end gap-2">
            <Button className="btn-secondary" onClick={async () => {
              try {
                const response = await apiRequest("POST", "/api/scheduling/notify-all", {});
                const result = await response.json();
                toast({ title: "Success", description: result.message });
              } catch (err: any) {
                toast({ title: "Error", description: "Failed to send schedules", variant: "destructive" });
              }
            }}>
              Send Daily Schedules
            </Button>
            <Button className="btn-primary" onClick={() => setNewDialogOpen(true)}>
              New Service Request
            </Button>
          </div>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <Card className="cursor-pointer card-surface hover:shadow-soft transition-all" onClick={() => setActiveTab("pending")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer card-surface hover:shadow-soft transition-all" onClick={() => setActiveTab("scheduled")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{scheduledCount}</p>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer card-surface hover:shadow-soft transition-all" onClick={() => setActiveTab("in_progress")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Play className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer card-surface hover:shadow-soft transition-all" onClick={() => setActiveTab("completed")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredRequests?.map((request: ServiceRequest) => {
                const requestHasTechnician = hasAssignedTechnician(request);
                const assignedTech = getAssignedTechnicianInfo(request);
                const assignButtonLabel = requestHasTechnician ? "Change Technician" : "Assign Technician";

                return (
                <Card key={(request as any)?._id || request.id} className={`card-surface hover:shadow-soft transition-all overflow-visible ${
                  request.isDuplicate 
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500' 
                    : request.status === 'completed' 
                      ? 'bg-green-50/80 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                      : ''
                }`}>
                  <CardContent className="p-6">
                    {/* Duplicate Warning Banner */}
                    {request.isDuplicate && (
                      <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          ⚠️ This container has {request.duplicateCount} active service requests
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold font-mono">
                            <Link to={`/service-requests/${request.id}`}>{request.requestNumber}</Link>
                          </h3>
                          {request.isDuplicate && (
                            <Badge className="bg-amber-500 text-white flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Duplicate ({request.duplicateCount}x)
                            </Badge>
                          )}
                          {getStatusBadge(request.status)}
                          <Badge className={`${getPriorityBadge(request.priority)} border rounded-full`}>
                            {request.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                        <p className="text-sm text-foreground">{request.issueDescription}</p>
                      </div>
                      <div className="space-y-2">
                        {request.container && (
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Container:</span>
                            <span className={`font-mono ${request.isDuplicate ? 'font-bold text-amber-700 dark:text-amber-400' : ''}`}>
                              {request.container.containerCode}
                            </span>
                          </div>
                        )}
                        {request.customer && (
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Customer:</span>
                            <span>{request.customer.companyName}</span>
                          </div>
                        )}
                        {assignedTech && (
                          <div className="flex items-center gap-2 text-sm">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Technician:</span>
                            <span>{assignedTech.name}</span>
                            {assignedTech.phone && (
                              <span className="text-xs text-muted-foreground">({assignedTech.phone})</span>
                            )}
                          </div>
                        )}
                        {request.scheduledDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Scheduled:</span>
                            <span>{new Date(request.scheduledDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technician uploads & report */}
                    {(request.beforePhotos?.length || request.afterPhotos?.length || request.resolutionNotes) && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Before Photos</p>
                            <div className="flex flex-wrap gap-2">
                              {request.beforePhotos?.map((ref: string, idx: number) => (
                                <a
                                  key={`before-${idx}`}
                                  className="block w-24 h-24 bg-muted rounded overflow-hidden border"
                                  href={`/api/whatsapp/media/${encodeURIComponent(ref)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={ref}
                                >
                                  <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(ref)}`} />
                                </a>
                              ))}
                              {(!request.beforePhotos || request.beforePhotos.length === 0) && (
                                <span className="text-xs text-muted-foreground">No photos</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">After Photos</p>
                            <div className="flex flex-wrap gap-2">
                              {request.afterPhotos?.map((ref: string, idx: number) => (
                                <a
                                  key={`after-${idx}`}
                                  className="block w-24 h-24 bg-muted rounded overflow-hidden border"
                                  href={`/api/whatsapp/media/${encodeURIComponent(ref)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={ref}
                                >
                                  <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(ref)}`} />
                                </a>
                              ))}
                              {(!request.afterPhotos || request.afterPhotos.length === 0) && (
                                <span className="text-xs text-muted-foreground">No photos</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Signed Report</p>
                            {request.resolutionNotes ? (
                              <pre className="text-xs whitespace-pre-wrap bg-muted rounded p-2 border max-h-40 overflow-auto">{request.resolutionNotes}</pre>
                            ) : (
                              <span className="text-xs text-muted-foreground">No report</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                      {request.status === "pending" && (
                        <div className="flex items-center gap-3 w-full relative z-10 overflow-visible flex-nowrap">
                          {!requestHasTechnician && (
                            <button
                              onClick={() => setLocation(`/assign-technician/${getRequestId(request)}`)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFD4E3] to-[#FFB899] text-[#111111] hover:opacity-95 font-semibold transition-all duration-300 shadow-sm"
                              title="Assign Technician"
                            >
                              <UserCog className="w-4 h-4" /> Assign Technician
                            </button>
                          )}

                          <button
                            onClick={() => startService.mutate(request.id)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#FFA07A] text-[#FFA07A] hover:bg-[#FFF2ED] dark:hover:bg-[#1F1F1F] transition-all duration-300"
                          >
                            <PlayCircle className="w-4 h-4" /> Start Service
                          </button>

                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setCancelDialogOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E0E0E0] text-[#888] hover:bg-[#FFF9F7] dark:border-[#555] dark:text-[#AAA] dark:hover:bg-[#2A2A2A] transition-all duration-300"
                          >
                            <XCircle className="w-4 h-4" /> Cancel
                          </button>
                        </div>
                      )}
                      {request.status === "scheduled" && (
                        <div className="flex items-center gap-3 w-full relative z-10 overflow-visible flex-nowrap">
                          <button
                            onClick={() => setLocation(`/assign-technician/${getRequestId(request)}`)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFD4E3] to-[#FFB899] text-[#111111] hover:opacity-95 font-semibold transition-all duration-300 shadow-sm"
                            title={requestHasTechnician ? "Change Technician" : "Assign Technician"}
                          >
                            <UserCog className="w-4 h-4" /> {assignButtonLabel}
                          </button>
                          <button
                            onClick={() => startService.mutate(request.id)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#FFA07A] text-[#FFA07A] hover:bg-[#FFF2ED] dark:hover:bg-[#1F1F1F] transition-all duration-300"
                          >
                            <PlayCircle className="w-4 h-4" /> Start Service
                          </button>

                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setCancelDialogOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E0E0E0] text-[#888] hover:bg-[#FFF9F7] dark:border-[#555] dark:text-[#AAA] dark:hover:bg-[#2A2A2A] transition-all duration-300"
                          >
                            <XCircle className="w-4 h-4" /> Cancel
                          </button>
                        </div>
                      )}
                      {request.status === "in_progress" && (
                        <Button
                          size="sm"
                          className="btn-primary"
                          onClick={() => {
                            setSelectedRequest(request);
                            setCompleteDialogOpen(true);
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete Service
                        </Button>
                      )}
                      {request.status === "completed" && (
                        <>
                          <Button
                            size="sm"
                            className="btn-secondary"
                            onClick={() => generateInvoice.mutate(request.id)}
                            disabled={generateInvoice.isPending}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            {generateInvoice.isPending ? "Generating..." : "Generate Invoice"}
                          </Button>
                          <Button size="sm" className="btn-secondary">
                            <Send className="h-3 w-3 mr-1" />
                            Send to Customer
                          </Button>
                        </>
                      )}
                      {request.status === "in_progress" && (
                        <Button
                          size="sm"
                          className="btn-secondary"
                          onClick={() => {
                            setSelectedRequest(request);
                            setCancelDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
              })}

              {(!filteredRequests || filteredRequests.length === 0) && (
                <div className="text-center py-12">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No service requests found</h3>
                  <p className="text-sm text-muted-foreground">
                    Service requests will appear here as they are created
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Assign Technician Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="card-surface">
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="technician">Select Technician</Label>
              <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians?.map((tech: any) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name} - {tech.experienceLevel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduledDate">Scheduled Date/Time</Label>
                <Input id="scheduledDate" type="datetime-local" value={assignScheduledDate} onChange={(e) => setAssignScheduledDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="timeWindow">Time Window (e.g., 10:00-12:00)</Label>
                <Input id="timeWindow" value={assignTimeWindow} onChange={(e) => setAssignTimeWindow(e.target.value)} placeholder="10:00-12:00" />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Service Request</p>
              <p className="text-xs text-muted-foreground">{selectedRequest?.requestNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">{selectedRequest?.issueDescription}</p>
            </div>
          </div>
          <DialogFooter>
            <Button className="btn-secondary" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" onClick={handleAssign} disabled={assignTechnician.isPending}>
              {assignTechnician.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Service Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="card-surface">
          <DialogHeader>
            <DialogTitle>Complete Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="completionNotes">Resolution Notes</Label>
              <Textarea
                id="completionNotes"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Describe the work performed..."
                rows={4}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Service Request</p>
              <p className="text-xs text-muted-foreground">{selectedRequest?.requestNumber}</p>
            </div>
          </div>
          <DialogFooter>
            <Button className="btn-secondary" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" onClick={handleComplete} disabled={completeService.isPending}>
              {completeService.isPending ? "Completing..." : "Complete Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Service Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="card-surface">
          <DialogHeader>
            <DialogTitle>Cancel Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancelReason">Cancellation Reason</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this service is being cancelled..."
                rows={3}
              />
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Warning</p>
                  <p className="text-xs text-red-700">
                    This action cannot be undone. The service request will be marked as cancelled.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="btn-secondary" onClick={() => setCancelDialogOpen(false)}>
              Keep Request
            </Button>
            <Button className="btn-primary" onClick={handleCancel} disabled={cancelService.isPending}>
              {cancelService.isPending ? "Cancelling..." : "Cancel Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Service Request Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Container</Label>
              <Combobox
                options={
                  containers?.map((c: any) => ({
                    value: c.id,
                    label: c.containerCode,
                    searchText: `${c.containerCode} ${c.currentLocation?.address || ''}`,
                  })) || []
                }
                value={newContainerId}
                onValueChange={(v) => {
                  setNewContainerId(v);
                  // If container picked, auto-select its customer
                  if (v) {
                    const selected = (allContainers as any[] | undefined)?.find(c => c.id === v);
                    if (selected && selected.currentCustomerId) {
                      setNewCustomerId(selected.currentCustomerId);
                    }
                  } else {
                    // If container cleared, clear customer too
                    setNewCustomerId("");
                  }
                }}
                placeholder="Select a container"
                searchPlaceholder="Search by container code..."
                emptyText={newCustomerId ? "No containers found for this customer." : "No containers found."}
              />
            </div>
            <div>
              <Label>Customer</Label>
              <Combobox
                options={
                  customers?.map((cust: any) => ({
                    value: cust.id,
                    label: cust.companyName,
                    searchText: `${cust.companyName} ${cust.contactPerson || ''}`,
                  })) || []
                }
                value={newCustomerId}
                onValueChange={(v) => {
                  setNewCustomerId(v);
                  // When choosing customer, clear container if it doesn't belong to this customer
                  if (newContainerId && allContainers) {
                    const containerBelongsToCustomer = (allContainers as any[]).some(
                      c => c.id === newContainerId && c.currentCustomerId === v
                    );
                    if (!containerBelongsToCustomer) {
                      setNewContainerId("");
                    }
                  }
                }}
                placeholder="Select a customer"
                searchPlaceholder="Search by customer name..."
                emptyText="No customers found."
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="issue">Issue Description</Label>
              <Textarea id="issue" value={newIssue} onChange={(e) => setNewIssue(e.target.value)} rows={4} placeholder="Describe the issue..." />
            </div>
            <div>
              <Label htmlFor="estimatedDuration">Estimated Duration (hours)</Label>
              <Input id="estimatedDuration" type="number" value={newEstimatedDuration} onChange={(e) => setNewEstimatedDuration(e.target.value)} placeholder="e.g., 2" />
            </div>
          </div>
          <DialogFooter>
            <Button className="btn-secondary" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" onClick={() => createRequest.mutate()} disabled={createRequest.isPending}>
              {createRequest.isPending ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
