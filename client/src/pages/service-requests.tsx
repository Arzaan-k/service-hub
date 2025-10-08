import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  UserCheck,
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
  resolutionNotes?: string;
  createdAt: string;
}

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["/api/service-requests"],
  });

  const { data: technicians } = useQuery({
    queryKey: ["/api/technicians"],
  });

  const assignTechnician = useMutation({
    mutationFn: async ({ id, technicianId }: { id: string; technicianId: string }) => {
      return await apiRequest("POST", `/api/service-requests/${id}/assign`, { technicianId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      setAssignDialogOpen(false);
      setSelectedRequest(null);
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
    assignTechnician.mutate({ id: selectedRequest.id, technicianId: selectedTechnicianId });
  };

  const handleComplete = () => {
    if (!selectedRequest) return;
    completeService.mutate({ id: selectedRequest.id, resolutionNotes: completionNotes });
  };

  const handleCancel = () => {
    if (!selectedRequest) return;
    cancelService.mutate({ id: selectedRequest.id, reason: cancelReason });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      pending: { color: "bg-gray-100 text-gray-800 border-gray-200", icon: Clock },
      approved: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
      scheduled: { color: "bg-purple-100 text-purple-800 border-purple-200", icon: Calendar },
      in_progress: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Play },
      completed: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
      cancelled: { color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
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
      urgent: "bg-red-100 text-red-800 border-red-200",
      high: "bg-orange-100 text-orange-800 border-orange-200",
      normal: "bg-blue-100 text-blue-800 border-blue-200",
      low: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return priorityMap[priority] || priorityMap.normal;
  };

  const filteredRequests = requests?.filter((req: ServiceRequest) => {
    if (activeTab === "all") return true;
    return req.status === activeTab;
  });

  // Calculate stats
  const pendingCount = requests?.filter((r: ServiceRequest) => r.status === "pending").length || 0;
  const scheduledCount = requests?.filter((r: ServiceRequest) => r.status === "scheduled").length || 0;
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab("pending")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab("scheduled")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{scheduledCount}</p>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab("in_progress")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Play className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab("completed")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
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
              {filteredRequests?.map((request: ServiceRequest) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold font-mono">{request.requestNumber}</h3>
                          {getStatusBadge(request.status)}
                          <Badge className={`${getPriorityBadge(request.priority)} border`}>
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
                            <span className="font-mono">{request.container.containerCode}</span>
                          </div>
                        )}
                        {request.customer && (
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Customer:</span>
                            <span>{request.customer.companyName}</span>
                          </div>
                        )}
                        {request.technician && (
                          <div className="flex items-center gap-2 text-sm">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Technician:</span>
                            <span>{request.technician.name}</span>
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

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                      {request.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setAssignDialogOpen(true);
                            }}
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assign Technician
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startService.mutate(request.id)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start Service
                          </Button>
                        </>
                      )}
                      {request.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startService.mutate(request.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start Service
                        </Button>
                      )}
                      {request.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="default"
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
                            variant="outline"
                            onClick={() => generateInvoice.mutate(request.id)}
                            disabled={generateInvoice.isPending}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            {generateInvoice.isPending ? "Generating..." : "Generate Invoice"}
                          </Button>
                          <Button size="sm" variant="outline">
                            <Send className="h-3 w-3 mr-1" />
                            Send to Customer
                          </Button>
                        </>
                      )}
                      {["pending", "scheduled", "in_progress"].includes(request.status) && (
                        <Button
                          size="sm"
                          variant="destructive"
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
              ))}

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
        <DialogContent>
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
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Service Request</p>
              <p className="text-xs text-muted-foreground">{selectedRequest?.requestNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">{selectedRequest?.issueDescription}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assignTechnician.isPending}>
              {assignTechnician.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Service Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
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
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={completeService.isPending}>
              {completeService.isPending ? "Completing..." : "Complete Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Service Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
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
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Request
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelService.isPending}>
              {cancelService.isPending ? "Cancelling..." : "Cancel Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
