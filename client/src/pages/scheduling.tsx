import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";
import { websocket } from "@/lib/websocket";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Package,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Plane,
  Eye,
  AlertTriangle,
} from "lucide-react";
import TripDetailSheet from "@/components/scheduling/trip-detail-sheet";
import { AutoPlanForm, AutoPlanFormPayload } from "@/components/travel/auto-plan-form";
import { AutoPlanLoader } from "@/components/travel/auto-plan-loader";
import { AutoPlanError } from "@/components/travel/auto-plan-error";
import { TechnicianCard } from "@/components/travel/technician-card";
import { CostTable, CostState } from "@/components/travel/cost-table";
import { TaskTable, TaskDraft } from "@/components/travel/task-table";
import { CreateTripButton } from "@/components/travel/create-trip-button";

interface ScheduledService {
  id: string;
  technician: {
    id: string;
    name: string;
  };
  container: {
    id: string;
    containerCode: string;
    currentLocation: any;
  };
  serviceRequest: {
    id: string;
    requestNumber: string;
    priority: string;
    issueDescription: string;
  };
  scheduledDate: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
  estimatedTravelTime: number;
  estimatedServiceDuration: number;
  sequenceNumber: number;
  status: string;
}

type AutoPlanResult = {
  technician: {
    id: string;
    name?: string;
    grade?: string;
    baseLocation?: string;
  } | null;
  technicianSuggestions: Array<{
    id: string;
    name: string;
    score: number;
    available: boolean;
    reasons: string[];
  }>;
  technicianSourceCity?: string;
  travelWindow: { start: string; end: string; days: number; nights: number };
  costs: CostState;
  tasks: TaskDraft[];
};

const roundCurrencyValue = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default function Scheduling() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = getCurrentUser();
  const role = (user?.role || "client").toLowerCase();
  const canSchedule = ["admin", "coordinator", "super_admin"].includes(role);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [pmAlert, setPmAlert] = useState<{
    containerId: string;
    containerCode: string;
    daysSinceLastPM: number;
    serviceRequestId: string;
    requestNumber: string;
    message: string;
    action: string;
  } | null>(null);
  const [showPmDialog, setShowPmDialog] = useState(false);

  const { data: serviceRequests, isLoading } = useQuery({
    queryKey: ["/api/service-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/service-requests");
      return await res.json();
    },
  });

  const { data: technicians } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technicians");
      return await res.json();
    },
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ["/api/service-requests/pending"],
    queryFn: async () => {
      if (!canSchedule) return [];
      const res = await apiRequest("GET", "/api/service-requests/pending");
      return await res.json();
    },
    enabled: canSchedule,
  });

  const { data: destinationCities = [] } = useQuery({
    queryKey: ["/api/containers/cities"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/containers/cities");
        if (!res.ok) throw new Error("Failed to fetch cities");
        const data = await res.json();
        // Ensure data is in the expected format: array of { name: string }
        return Array.isArray(data) ? data.map((item: any) => 
          typeof item === 'string' ? { name: item } : item
        ) : [];
      } catch {
        return [
          { name: "Chennai" },
          { name: "Mumbai" },
          { name: "Delhi" },
          { name: "Bengaluru" },
          { name: "Hyderabad" },
          { name: "Pune" },
          { name: "Kolkata" }
        ];
      }
    },
    enabled: activeTab === "travel",
  });

  const [autoPlanParams, setAutoPlanParams] = useState<AutoPlanFormPayload | null>(null);
  const [autoPlanData, setAutoPlanData] = useState<AutoPlanResult | null>(null);
  const [pmPlanData, setPmPlanData] = useState<{
    techId: string;
    city: string;
    range: { start: string; end: string };
    pmCount: number;
    dailyPlan: Array<{ date: string; tasks: Array<{ id: string; type: string; containerId: string; siteName?: string; serviceRequestId?: string | null }> }>;
    costs?: {
      travelFare?: { value: number | string };
      stayCost?: { value: number | string };
      dailyAllowance?: { value: number | string };
      localTravelCost?: { value: number | string };
      miscCost?: { value: number | string };
      totalEstimatedCost?: number | string;
    };
  } | null>(null);
  const [costDraft, setCostDraft] = useState<CostState | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [planPurpose, setPlanPurpose] = useState("pm");
  const [planNotes, setPlanNotes] = useState("");

  const autoPlanMutation = useMutation({
    mutationFn: async (payload: AutoPlanFormPayload) => {
      // Use new PM-first endpoint
      const res = await apiRequest("POST", "/api/scheduling/plan-trip", {
        city: payload.destinationCity,
        startDate: payload.startDate,
        endDate: payload.endDate,
        technicianId: payload.technicianId,
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Failed to auto-plan travel";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: (data, variables) => {
      setAutoPlanParams(variables);
      setPmPlanData(data);
      setSelectedTechnicianId(data.techId || variables.technicianId || null);
      setPlanPurpose("pm");
      setPlanNotes("");
      toast({
        title: "Auto plan ready",
        description: `Found ${data.pmCount} PM tasks. Review and confirm to send to technician.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Auto plan failed",
        description: error?.message || "Unable to auto-plan travel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const confirmTripMutation = useMutation({
    mutationFn: async () => {
      if (!pmPlanData || !pmPlanData.techId) {
        throw new Error("Plan not ready");
      }
      const res = await apiRequest("POST", "/api/scheduling/confirm-trip", {
        techId: pmPlanData.techId,
        plan: pmPlanData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Failed to confirm trip";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Trip confirmed and sent to technician!",
        description: `PM trip assigned with ${data.scheduledPMRequests?.length || pmPlanData?.pmCount || 0} PM tasks.`,
      });
      setPmPlanData(null);
      setAutoPlanParams(null);
      setSelectedTechnicianId(null);
      // Refresh queries to update technician views immediately
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
      if (pmPlanData?.techId) {
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", pmPlanData.techId] });
        queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to confirm trip",
        description: error?.message || "Unable to confirm and send trip.",
        variant: "destructive",
      });
    },
  });

  const createTripMutation = useMutation({
    mutationFn: async () => {
      if (!autoPlanParams || !costDraft) {
        throw new Error("Auto plan not ready");
      }

      const technicianIdToUse =
        selectedTechnicianId ||
        autoPlanData?.technician?.id ||
        autoPlanData?.technicianSuggestions?.find((s: any) => s.available)?.id ||
        autoPlanData?.technicianSuggestions?.[0]?.id ||
        autoPlanParams.technicianId;

      const payload = {
        technicianId: technicianIdToUse,
        destinationCity: autoPlanParams.destinationCity,
        startDate: autoPlanParams.startDate,
        endDate: autoPlanParams.endDate,
        purpose: planPurpose,
        notes: planNotes,
        costs: costDraft,
        tasks: taskDraft.map((task) => ({
          containerId: task.containerId,
          siteName: task.siteName,
          customerId: task.customerId,
          taskType: task.taskType,
          priority: task.priority,
          scheduledDate: task.scheduledDate || autoPlanParams.startDate,
          estimatedDurationHours: task.estimatedDurationHours ?? 2,
          serviceRequestId: task.serviceRequestId,
          alertId: task.alertId,
          notes: task.notes,
          source: task.source || (task.isManual ? "manual" : "auto"),
          isManual: Boolean(task.isManual),
        })),
      };

      const res = await apiRequest("POST", "/api/travel/trips", payload);
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to create trip");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Trip created",
        description: "Technician travel plan saved and shared automatically.",
      });
      setAutoPlanData(null);
      setCostDraft(null);
      setTaskDraft([]);
      setSelectedTechnicianId(null);
      setAutoPlanParams(null);
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create trip",
        description: error?.message || "Unable to create technician trip.",
        variant: "destructive",
      });
    },
  });

  const handleAutoPlanSubmit = (payload: AutoPlanFormPayload) => {
    setAutoPlanParams(payload);
    setAutoPlanData(null);
    setCostDraft(null);
    setTaskDraft([]);
    setSelectedTechnicianId(payload.technicianId || null);
    autoPlanMutation.mutate(payload);
  };

  const handleCreateTrip = () => {
    createTripMutation.mutate();
  };

  const runOptimization = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scheduling/run");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to run auto-assignment" }));
        const error: any = new Error(errorData.error || "Failed to run auto-assignment");
        error.response = { data: errorData };
        throw error;
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
      
      const assignedCount = data?.assigned?.length || 0;
      const skippedCount = data?.skipped?.length || 0;
      const totalCount = assignedCount + skippedCount;
      
      if (assignedCount > 0) {
        // Show success notification with distribution summary
        const distributionInfo = data?.distributionSummary?.length > 0 || data?.byTechnician?.length > 0
          ? `\nDistribution: ${(data.distributionSummary || data.byTechnician || []).map((d: any) => {
              const count = d.newAssignments || d.countAssigned || 0;
              const name = d.name || d.technicianId?.slice(0, 8) || d.techId?.slice(0, 8) || 'tech';
              return count > 0 ? `${count} to ${name}` : null;
            }).filter(Boolean).join(', ')}`
          : '';
        
        toast({
          title: "Successfully auto-assigned requests.",
          description: `Assigned ${assignedCount} request${assignedCount === 1 ? '' : 's'}${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${distributionInfo}`,
        });
      } else if (totalCount > 0) {
        // Notification if no assignments were made
        const reasons = data?.skipped?.map((s: any) => s.reason).filter((r: string, i: number, arr: string[]) => arr.indexOf(r) === i).join(', ') || 'Unknown reason';
        toast({
          title: "No Assignments Made",
          description: `No requests could be assigned. Reasons: ${reasons}`,
          variant: "destructive",
        });
      } else {
        // All requests already assigned
        toast({
          title: "All Requests Assigned",
          description: "No pending requests to assign.",
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to run auto-assignment";
      const errorCode = error?.response?.data?.code;
      
      toast({
        title: "Auto-Scheduling Failed",
        description: errorCode === 'NO_INTERNAL_TECHNICIANS' 
          ? "No internal technicians available. Please ensure technicians have category = 'internal' and are available."
          : errorCode === 'NO_UNASSIGNED_SERVICE_REQUESTS'
          ? "No unassigned requests found. All requests are already assigned."
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const sendSchedules = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scheduling/notify-all", { date: selectedDate });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Schedules Sent",
        description: "Daily schedules sent to all technicians via WhatsApp",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Send",
        description: "Could not send schedules to technicians",
        variant: "destructive",
      });
    },
  });

  const handleRunOptimization = () => {
    // Run immediately without confirmation
    runOptimization.mutate();
  };

  // Manual PM check mutation
  const runPMCheck = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pm/check");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PM Check Completed",
        description: data.message || `Found ${data.count || 0} container(s) needing preventive maintenance`,
        variant: data.count > 0 ? "default" : "default",
      });
      // Refresh service requests to show any new PM tickets
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
    },
    onError: (error: any) => {
      toast({
        title: "PM Check Failed",
        description: error?.message || "Failed to run preventive maintenance check",
        variant: "destructive",
      });
    },
  });

  // Listen for PM alerts via WebSocket
  useEffect(() => {
    if (!canSchedule) return; // Only admins/coordinators see PM alerts

    const handlePMAlert = (data: any) => {
      console.log('[Scheduling] Received PM alert:', data);
      setPmAlert({
        containerId: data.containerId,
        containerCode: data.containerCode,
        daysSinceLastPM: data.daysSinceLastPM,
        serviceRequestId: data.serviceRequestId,
        requestNumber: data.requestNumber,
        message: data.message || `⚠️ MAINTENANCE ALERT: Container ${data.containerCode} has reached its 90-day limit.`,
        action: data.action || "Move to Maintenance Bay",
      });
      setShowPmDialog(true);
      
      // Show toast notification
      toast({
        title: "Preventive Maintenance Alert",
        description: `Container ${data.containerCode} needs preventive maintenance`,
        variant: "destructive",
      });

      // Refresh service requests to show the new PM ticket
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
    };

    websocket.on("pm_alert", handlePMAlert);

    return () => {
      websocket.off("pm_alert", handlePMAlert);
    };
  }, [canSchedule, queryClient, toast]);

  // Handle PM alert acknowledgment
  const handlePmAcknowledged = async () => {
    if (!pmAlert) return;

    try {
      // Optionally update container location to "Maintenance" if needed
      // For now, just close the dialog and refresh data
      setShowPmDialog(false);
      setPmAlert(null);
      
      // Refresh service requests
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
      
      toast({
        title: "PM Alert Acknowledged",
        description: `Service request ${pmAlert.requestNumber} has been created for Container ${pmAlert.containerCode}`,
      });
    } catch (error) {
      console.error("Error acknowledging PM alert:", error);
    }
  };

  // Filter service requests by selected date and group by technician
  const selectedDateObj = new Date(selectedDate);
  const scheduledRequests = serviceRequests?.filter((req: any) => {
    if (!req.scheduledDate) return false;
    const schedDate = new Date(req.scheduledDate);
    return schedDate.toDateString() === selectedDateObj.toDateString();
  }) || [];

  // Group by technician
  const scheduleByTechnician = scheduledRequests.reduce((acc: any, req: any) => {
    if (!req.assignedTechnicianId) return acc;
    const techId = req.assignedTechnicianId;
    if (!acc[techId]) {
      const tech = technicians?.find((t: any) => t.id === techId);
      acc[techId] = {
        technician: tech || { id: techId, name: 'Unknown Technician' },
        services: [],
      };
    }
    acc[techId].services.push(req);
    return acc;
  }, {});

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      scheduled: "bg-blue-500/20 text-blue-200 border-blue-400/30",
      in_progress: "bg-yellow-500/20 text-yellow-200 border-yellow-400/30",
      completed: "bg-green-500/20 text-green-200 border-green-400/30",
      cancelled: "bg-red-500/20 text-red-200 border-red-400/30",
    };
    return statusMap[status] || statusMap.scheduled;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, string> = {
      urgent: "bg-red-500/20 text-red-200 border-red-400/30",
      high: "bg-orange-500/20 text-orange-200 border-orange-400/30",
      normal: "bg-blue-500/20 text-blue-200 border-blue-400/30",
      low: "bg-gray-500/20 text-gray-200 border-gray-400/30",
    };
    return priorityMap[priority] || priorityMap.normal;
  };

  const technicianSchedules = Object.values(scheduleByTechnician);

  // Fetch trips for Technician Travel tab
  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["/api/scheduling/travel/trips"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scheduling/travel/trips");
      return await res.json();
    },
    enabled: activeTab === "travel",
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Scheduling" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="grid w-[400px] grid-cols-2">
                <TabsTrigger value="daily">Daily Schedule</TabsTrigger>
                <TabsTrigger value="travel">Technician Travel & Auto PM</TabsTrigger>
              </TabsList>
            </div>

            {/* Daily Schedule Tab */}
            <TabsContent value="daily" className="space-y-6 mt-6">
              {/* Header Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Daily Schedule</h2>
                  <p className="text-sm text-muted-foreground">
                    AI-powered service scheduling and route optimization
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 input-soft rounded-lg text-sm"
                    title="Select date to view schedule"
                  />
                  {canSchedule && (
                    <>
                      <Button
                        onClick={handleRunOptimization}
                        disabled={runOptimization.isPending}
                        className="gap-2"
                        title="Auto-assign all pending requests (dates determined automatically)"
                      >
                        <Sparkles className="h-4 w-4" />
                        {runOptimization.isPending ? "Auto-Assigning..." : "Auto-Assign Pending"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => sendSchedules.mutate()}
                        disabled={sendSchedules.isPending}
                        className="gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {sendSchedules.isPending ? "Sending..." : "Send Schedules"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => runPMCheck.mutate()}
                        disabled={runPMCheck.isPending}
                        className="gap-2"
                        title="Check for containers needing preventive maintenance (90+ days since last PM)"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        {runPMCheck.isPending ? "Checking..." : "Check PM"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <Card className="card-surface hover:shadow-soft transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-200" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {scheduledRequests.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Scheduled Services</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-surface hover:shadow-soft transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-green-200" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {technicians?.filter((t: any) => t.status === 'available' || t.status === 'on_duty').length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active Technicians</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {canSchedule && (
              <Card className="card-surface hover:shadow-soft transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-orange-200" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {pendingRequests?.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Pending Requests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {canSchedule && (
              <Card className="card-surface hover:shadow-soft transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-purple-200" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">85%</p>
                      <p className="text-xs text-muted-foreground">Optimization Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Technician Schedules */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : technicianSchedules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No Schedule for this Date
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {canSchedule ? "Run auto-assignment to schedule pending requests" : "Schedule will appear here when generated"}
                </p>
                {canSchedule && (
                  <Button onClick={handleRunOptimization} disabled={runOptimization.isPending}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Auto-Assign Requests
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {technicianSchedules.map((techSchedule: any) => (
                <Card key={techSchedule.technician.id} className="card-surface hover:shadow-soft transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{techSchedule.technician.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {techSchedule.services.length} services scheduled
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30 border">
                        {techSchedule.services.reduce(
                          (total: number, s: any) =>
                            total + (s.estimatedDuration || 90),
                          0
                        )}{" "}
                        min
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {techSchedule.services
                        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((service: any, index: number) => (
                          <div
                            key={service.id}
                            className="flex items-start gap-4 p-4 border rounded-lg transition-colors"
                            style={{ borderColor: '#FFE0D6', background: 'white' }}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium text-foreground">
                                    {service.container?.containerCode || service.containerId}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    SR #{service.requestNumber}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Badge className={`${getPriorityBadge(service.priority)} border text-xs`}>
                                    {service.priority}
                                  </Badge>
                                  <Badge className={`${getStatusBadge(service.status)} border text-xs`}>
                                    {service.status}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-foreground">
                                {service.issueDescription}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {service.scheduledTimeWindow || 'ASAP'}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {service.estimatedDuration || 90} min
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {service.scheduledDate ? new Date(service.scheduledDate).toLocaleDateString() : 'Not scheduled'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
            </TabsContent>

            {/* Technician Travel Tab */}
            <TabsContent value="travel" className="space-y-6 mt-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Technician Travel & Auto PM</h2>
                <p className="text-sm text-muted-foreground">
                  Generate trips automatically, review costs and PM tasks, then save in one click.
                </p>
              </div>

              <AutoPlanForm
                destinations={destinationCities}
                technicians={technicians || []}
                onSubmit={handleAutoPlanSubmit}
                isLoading={autoPlanMutation.isPending}
              />

              {autoPlanMutation.isPending && <AutoPlanLoader />}

              {autoPlanMutation.isError && autoPlanParams && (
                <AutoPlanError
                  message={(autoPlanMutation.error as Error)?.message}
                  onRetry={() => autoPlanParams && autoPlanMutation.mutate(autoPlanParams)}
                  isRetrying={autoPlanMutation.isPending}
                />
              )}

              {!pmPlanData && !autoPlanMutation.isPending && !autoPlanMutation.isError && (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Run the auto planner above to see PM tasks and daily schedule.
                    The system will automatically prioritize PM tasks and distribute them across travel days.
                  </CardContent>
                </Card>
              )}

              {pmPlanData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Planned Trip</span>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-400/30">
                        {pmPlanData.pmCount} PM Tasks
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">City</Label>
                        <p className="font-medium">{pmPlanData.city}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Technician</Label>
                        <p className="font-medium">
                          {technicians?.find((t: any) => t.id === pmPlanData.techId)?.name || 
                           technicians?.find((t: any) => t.id === pmPlanData.techId)?.employeeCode || 
                           "Selected Technician"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Start Date</Label>
                        <p className="font-medium">
                          {new Date(pmPlanData.range.start).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">End Date</Label>
                        <p className="font-medium">
                          {new Date(pmPlanData.range.end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {(pmPlanData as any).costs && (
                      <div className="mt-4 border rounded-lg p-4 bg-muted/50">
                        <Label className="text-muted-foreground mb-3 block">Cost Breakdown</Label>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Travel Fare:</span>
                            <p className="font-medium">₹{Number((pmPlanData as any).costs.travelFare?.value || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stay Cost:</span>
                            <p className="font-medium">₹{Number((pmPlanData as any).costs.stayCost?.value || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Daily Allowance:</span>
                            <p className="font-medium">₹{Number((pmPlanData as any).costs.dailyAllowance?.value || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Local Travel:</span>
                            <p className="font-medium">₹{Number((pmPlanData as any).costs.localTravelCost?.value || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Miscellaneous:</span>
                            <p className="font-medium">₹{Number((pmPlanData as any).costs.miscCost?.value || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Estimated Cost:</span>
                            <p className="font-bold text-lg">₹{Number((pmPlanData as any).costs.totalEstimatedCost || 0).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <Label className="text-muted-foreground mb-2 block">Daily Schedule</Label>
                      <div className="space-y-2">
                        {pmPlanData.dailyPlan.map((day, idx) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">
                                {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                              <Badge variant="outline">{day.tasks.length} tasks</Badge>
                            </div>
                            <div className="space-y-1">
                              {day.tasks.map((task, taskIdx) => (
                                <div key={taskIdx} className="flex items-center gap-2 text-sm">
                                  <Badge 
                                    variant={task.type === 'PM' ? 'default' : 'secondary'}
                                    className={task.type === 'PM' ? 'bg-orange-500/20 text-orange-400 border-orange-400/30' : ''}
                                  >
                                    {task.type === 'PM' ? '🛠 Preventive Maintenance' : 'BREAKDOWN'}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {task.siteName || `Container ${task.containerId.substring(0, 8)}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => confirmTripMutation.mutate()}
                        disabled={confirmTripMutation.isPending}
                        className="flex-1 gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {confirmTripMutation.isPending ? "Confirming..." : "Confirm & Send"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPmPlanData(null);
                          setAutoPlanParams(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {autoPlanData && costDraft && (
                <div className="space-y-4">
                  <TechnicianCard
                    technician={autoPlanData.technician}
                    suggestions={autoPlanData.technicianSuggestions}
                    selectedTechnicianId={selectedTechnicianId}
                    onTechnicianChange={setSelectedTechnicianId}
                    technicianSourceCity={autoPlanData.technicianSourceCity}
                  />

                  <Card>
                    <CardHeader>
                      <CardTitle>Trip Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Purpose</Label>
                        <Select value={planPurpose} onValueChange={setPlanPurpose}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pm">Preventive Maintenance</SelectItem>
                            <SelectItem value="breakdown">Breakdown</SelectItem>
                            <SelectItem value="audit">Audit</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes / Instructions</Label>
                        <Textarea
                          value={planNotes}
                          onChange={(e) => setPlanNotes(e.target.value)}
                          placeholder="Optional notes for the technician..."
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {!autoPlanData.technician && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>No suitable technician found</AlertTitle>
                      <AlertDescription>
                        Please pick a technician manually from the dropdown above before saving the trip.
                      </AlertDescription>
                    </Alert>
                  )}

                  {taskDraft.length === 0 && (
                    <Alert className="border-yellow-500/40 bg-yellow-500/10 text-yellow-900">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>No tasks generated</AlertTitle>
                      <AlertDescription>
                        The system could not find containers needing PM/alerts. Add at least one task manually before saving.
                      </AlertDescription>
                    </Alert>
                  )}

                  <CostTable
                    costs={costDraft}
                    onChange={(key, value, manual) =>
                      setCostDraft((prev) => {
                        if (!prev) return prev;
                        const updated: CostState = {
                          ...prev,
                          [key]: { value, isManual: manual },
                        };
                        const total =
                          updated.travelFare.value +
                          updated.stayCost.value +
                          updated.dailyAllowance.value +
                          updated.localTravelCost.value +
                          updated.miscCost.value;
                        return {
                          ...updated,
                          totalEstimatedCost: roundCurrencyValue(total),
                        };
                      })
                    }
                  />

                  <TaskTable tasks={taskDraft} onChange={setTaskDraft} />

                  <div className="flex justify-end">
                    <CreateTripButton
                      onClick={handleCreateTrip}
                      disabled={createTripMutation.isPending}
                      isLoading={createTripMutation.isPending}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4">
                <h3 className="text-lg font-semibold mb-3">Planned Trips</h3>
                {tripsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : trips.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        No Trips Planned
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Run the auto planner above and click “Create Trip” to add the first travel plan.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Technician</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Trip Status</TableHead>
                            <TableHead>Booking Status</TableHead>
                            <TableHead>Total Cost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trips.map((trip: any) => (
                            <TableRow
                              key={trip.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedTripId(trip.id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {trip.technician?.name || trip.technician?.user?.name || trip.technicianId || "Unknown"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span>{trip.destinationCity}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">
                                    {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    trip.tripStatus === "completed"
                                      ? "bg-green-500/20 text-green-400 border-green-400/30"
                                      : trip.tripStatus === "in_progress"
                                      ? "bg-blue-500/20 text-blue-400 border-blue-400/30"
                                      : trip.tripStatus === "booked"
                                      ? "bg-purple-500/20 text-purple-400 border-purple-400/30"
                                      : trip.tripStatus === "cancelled"
                                      ? "bg-red-500/20 text-red-400 border-red-400/30"
                                      : "bg-gray-500/20 text-gray-400 border-gray-400/30"
                                  }
                                >
                                  {trip.tripStatus || "planned"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {trip.bookingStatus === "all_confirmed"
                                    ? "✓ All Confirmed"
                                    : trip.bookingStatus === "hotel_booked"
                                    ? "🏨 Hotel Booked"
                                    : trip.bookingStatus === "tickets_booked"
                                    ? "🎫 Tickets Booked"
                                    : "Not Started"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  ₹{parseFloat(trip.costs?.totalEstimatedCost || 0).toLocaleString("en-IN")}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTripId(trip.id);
                                  }}
                                  className="gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Trip Detail Sheet */}
          {selectedTripId && (
            <TripDetailSheet
              tripId={selectedTripId}
              open={!!selectedTripId}
              onOpenChange={(open) => {
                if (!open) setSelectedTripId(null);
              }}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips"] });
              }}
            />
          )}

          {/* PM Alert Dialog */}
          <Dialog open={showPmDialog} onOpenChange={setShowPmDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Preventive Maintenance Alert
                </DialogTitle>
                <DialogDescription>
                  {pmAlert?.message || "A container requires preventive maintenance"}
                </DialogDescription>
              </DialogHeader>
              {pmAlert && (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-950/20">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Container:</span>
                        <span className="font-bold">{pmAlert.containerCode}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Days Since Last PM:</span>
                        <Badge variant="destructive">{pmAlert.daysSinceLastPM} days</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Service Request:</span>
                        <span className="text-sm font-mono">{pmAlert.requestNumber}</span>
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          <strong>Required Action:</strong> {pmAlert.action}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPmDialog(false);
                    setPmAlert(null);
                  }}
                >
                  Close
                </Button>
                <Button onClick={handlePmAcknowledged}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Acknowledge
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
