import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";
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
        return await res.json();
      } catch {
        return ["Chennai", "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Kolkata"];
      }
    },
    enabled: activeTab === "travel",
  });

  const [autoPlanParams, setAutoPlanParams] = useState<AutoPlanFormPayload | null>(null);
  const [autoPlanData, setAutoPlanData] = useState<AutoPlanResult | null>(null);
  const [costDraft, setCostDraft] = useState<CostState | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [planPurpose, setPlanPurpose] = useState("pm");
  const [planNotes, setPlanNotes] = useState("");

  const autoPlanMutation = useMutation({
    mutationFn: async (payload: AutoPlanFormPayload) => {
      const res = await apiRequest("POST", "/api/travel/auto-plan", payload);
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to auto-plan travel");
      }
      return await res.json();
    },
    onSuccess: (data, variables) => {
      setAutoPlanParams(variables);
      setAutoPlanData(data);
      setCostDraft(data.costs);
      setTaskDraft(data.tasks);
      setSelectedTechnicianId(
        data.technician?.id ||
          variables.technicianId ||
          data.technicianSuggestions?.find((s: any) => s.available)?.id ||
          data.technicianSuggestions?.[0]?.id ||
          null
      );
      setPlanPurpose("pm");
      setPlanNotes("");
      toast({
        title: "Auto plan ready",
        description: "Review the technician, costs, and tasks before saving the trip.",
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
        const distributionInfo = data?.distributionSummary?.length > 0
          ? `\nDistribution: ${data.distributionSummary.map((d: any) => `${d.countAssigned} to tech ${d.techId.slice(0, 8)}`).join(', ')}`
          : '';
        
        toast({
          title: "Auto-Assignment Complete",
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
    onError: () => {
      toast({
        title: "Auto-Scheduling Failed",
        description: "Failed to run auto-assignment",
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
                  />
                  {canSchedule && (
                    <>
                      <Button
                        onClick={handleRunOptimization}
                        disabled={runOptimization.isPending}
                        className="gap-2"
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

              {!autoPlanData && !autoPlanMutation.isPending && !autoPlanMutation.isError && (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Run the auto planner above to see technician recommendations, estimated costs, and PM tasks.
                    The UI will always show the latest result, along with alerts if something is missing.
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
        </div>
      </main>
    </div>
  );
}
