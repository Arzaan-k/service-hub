import { useState, useEffect, useMemo } from "react";
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
  Building2,
  Users,
  ArrowLeft,
  Square,
  CheckSquare,
  Navigation,
  TrendingUp,
  Truck,
  Target,
  Zap,
  ChevronRight,
  Phone,
  Wrench,
  FileText,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import TripDetailSheet from "@/components/scheduling/trip-detail-sheet";
import { AutoPlanForm, AutoPlanFormPayload } from "@/components/travel/auto-plan-form";
import { AutoPlanLoader } from "@/components/travel/auto-plan-loader";
import { AutoPlanError } from "@/components/travel/auto-plan-error";
import { ConsolidatedTripCard } from "@/components/scheduling/consolidated-trip-card";
import { TripFinancePDF } from "@/components/trips/trip-finance-pdf";
import { PlannedTripsList } from "@/components/trips/planned-trips-list";
import { TechnicianCard } from "@/components/travel/technician-card";
import { CostTable, CostState } from "@/components/travel/cost-table";
import { TaskTable, TaskDraft } from "@/components/travel/task-table";
import { CreateTripButton } from "@/components/travel/create-trip-button";
import { TechnicianTripDetailsModal } from "@/components/scheduling/technician-trip-details-modal";

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
  const [selectedPmContainer, setSelectedPmContainer] = useState<{
    containerId: string;
    containerCode: string;
    depot: string;
    customerName: string;
    daysSincePm: number | null;
  } | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [showTechnicianDetailsModal, setShowTechnicianDetailsModal] = useState(false);

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

  // Third-party technicians for PM assignment
  const { data: thirdPartyTechnicians } = useQuery({
    queryKey: ["/api/thirdparty-technicians"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/thirdparty-technicians");
      return await res.json();
    },
  });

  // Technician location overview with PM recommendations
  const { data: locationOverview, isLoading: locationLoading, refetch: refetchLocationOverview } = useQuery({
    queryKey: ["/api/technicians/location-overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technicians/location-overview");
      return await res.json();
    },
    enabled: canSchedule && activeTab === "tech-locations",
  });

  // State for smart assign feature
  const [selectedTechForSmartPlan, setSelectedTechForSmartPlan] = useState<any | null>(null);
  const [selectedCityForPlan, setSelectedCityForPlan] = useState<string>("");
  const [showSmartPlanDialog, setShowSmartPlanDialog] = useState(false);

  // Removed trip filters as per user request

  // State for PDF preview
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);

  const { data: pendingRequests } = useQuery({
    queryKey: ["/api/service-requests/pending"],
    queryFn: async () => {
      if (!canSchedule) return [];
      const res = await apiRequest("GET", "/api/service-requests/pending");
      return await res.json();
    },
    enabled: canSchedule,
  });

  // PM Overview data
  const { data: pmOverview, isLoading: pmLoading, refetch: refetchPM, error: pmError } = useQuery({
    queryKey: ["/api/pm/overview"],
    queryFn: async () => {
      console.log('[PM Overview] Fetching data...');
      const res = await apiRequest("GET", "/api/pm/overview");
      const text = await res.text();
      console.log('[PM Overview] Raw response:', text.substring(0, 500));
      try {
        const data = JSON.parse(text);
        console.log('[PM Overview] Parsed data:', data);
        return data;
      } catch (e) {
        console.error('[PM Overview] JSON parse error:', e);
        throw new Error('Invalid JSON response from server');
      }
    },
    enabled: canSchedule && activeTab === "pm-overview",
    staleTime: 30000,
  });

  const internalTechnicianIds = useMemo(() => {
    const ids = new Set<string>();
    if (Array.isArray(technicians)) {
      technicians.forEach((tech: any) => {
        const techId = tech?.id ?? tech?._id ?? tech?.technicianId;
        if (techId !== undefined && techId !== null) {
          ids.add(String(techId));
        }
      });
    }
    return ids;
  }, [technicians]);

  const technicianDirectoryLoaded = Array.isArray(technicians);

  const requestHasTechnician = (req: any) => {
    const rawId = req?.assignedTechnicianId;
    const trimmedId = typeof rawId === "string" ? rawId.trim() : rawId;
    const normalizedId = trimmedId === undefined || trimmedId === null ? "" : String(trimmedId);

    if (normalizedId) {
      if (!technicianDirectoryLoaded) {
        return true;
      }
      if (internalTechnicianIds.has(normalizedId)) {
        return true;
      }
    }

    return Boolean(req?.technician);
  };

  const derivedPendingRequests = useMemo(() => {
    if (Array.isArray(pendingRequests) && pendingRequests.length > 0) {
      return pendingRequests;
    }
    if (!Array.isArray(serviceRequests)) return [];
    return serviceRequests.filter((req: any) => {
      const status = (req?.status || '').toLowerCase();
      return !requestHasTechnician(req) && status !== 'completed' && status !== 'cancelled';
    });
  }, [pendingRequests, serviceRequests]);

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
  const [planPurpose, setPlanPurpose] = useState("pm");
  const [planNotes, setPlanNotes] = useState("");
  const [pmFilter, setPmFilter] = useState<"all" | "needs_pm" | "overdue" | "never" | "due_soon" | "up_to_date">("overdue");
  const [selectedClient, setSelectedClient] = useState<{
    customerId: string;
    customerName: string;
    pendingPm: number;
  } | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignTechnicianId, setAssignTechnicianId] = useState<string>("");
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
  const [selectedPmTaskIds, setSelectedPmTaskIds] = useState<Set<string>>(new Set());

  // Initialize selectedPmTaskIds when pmPlanData changes
  useEffect(() => {
    if (pmPlanData?.dailyPlan) {
      const allTaskIds = new Set<string>();
      pmPlanData.dailyPlan.forEach(day => {
        day.tasks.forEach(task => {
          if (task.id) allTaskIds.add(task.id);
        });
      });
      setSelectedPmTaskIds(allTaskIds);
    } else {
      setSelectedPmTaskIds(new Set());
    }
  }, [pmPlanData]);

  // PM Clients Summary - Group by client (defined after selectedClient state)
  const { data: pmClientsSummary, isLoading: pmClientsLoading, refetch: refetchPMClients } = useQuery({
    queryKey: ["/api/pm/clients-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pm/clients-summary");
      if (!res.ok) throw new Error("Failed to fetch PM clients summary");
      return await res.json();
    },
    enabled: canSchedule && activeTab === "pm-overview",
    staleTime: 30000,
  });

  // PM containers for selected client (defined after selectedClient state)
  const { data: clientPmContainers, isLoading: clientPmLoading, refetch: refetchClientPm } = useQuery({
    queryKey: ["/api/pm/client", selectedClient?.customerId],
    queryFn: async () => {
      if (!selectedClient?.customerId) return null;
      const res = await apiRequest("GET", `/api/pm/client/${selectedClient.customerId}`);
      if (!res.ok) throw new Error("Failed to fetch client PM containers");
      return await res.json();
    },
    enabled: canSchedule && activeTab === "pm-overview" && !!selectedClient?.customerId,
  });

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
      // Filter daily plan to only include selected tasks
      const filteredDailyPlan = pmPlanData.dailyPlan.map(day => ({
        ...day,
        tasks: day.tasks.filter(task => selectedPmTaskIds.has(task.id))
      })).filter(day => day.tasks.length > 0);
      
      const filteredPlan = {
        ...pmPlanData,
        dailyPlan: filteredDailyPlan,
        pmCount: selectedPmTaskIds.size,
      };
      
      const res = await apiRequest("POST", "/api/scheduling/confirm-trip", {
        techId: pmPlanData.techId,
        plan: filteredPlan,
        selectedTaskIds: Array.from(selectedPmTaskIds),
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


  // Sync PM dates from service_history
  const syncPMDates = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pm/sync");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PM Sync Completed",
        description: data.message || "PM dates synced from service history",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/overview"] });
    },
    onError: (error: any) => {
      toast({
        title: "PM Sync Failed",
        description: error?.message || "Failed to sync PM dates",
        variant: "destructive",
      });
    },
  });

  // Bulk assign PMs for a client to a technician
  const bulkAssignPMMutation = useMutation({
    mutationFn: async (payload: { customerId: string; technicianId: string; scheduledDate: string; containerIds?: string[] }) => {
      // Check if it's a third-party technician
      const isThirdParty = payload.technicianId.startsWith('thirdparty:');
      const actualTechId = isThirdParty 
        ? payload.technicianId.replace('thirdparty:', '') 
        : payload.technicianId;
      
      const res = await apiRequest("POST", "/api/pm/assign-client-bulk", {
        customerId: payload.customerId,
        technicianId: actualTechId,
        technicianType: isThirdParty ? 'thirdparty' : 'internal',
        scheduledDate: payload.scheduledDate,
        scheduledTimeWindow: "09:00-17:00",
        containerIds: payload.containerIds, // Optional: if not provided, assigns all pending containers
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('[PM Assign] Error response:', errorData);
        throw new Error(errorData.details || errorData.error || "Failed to assign PMs");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PMs Assigned Successfully",
        description: `Assigned ${data.assignedCount} PM service requests to ${data.technician?.name || 'technician'}`,
      });
      setShowAssignDialog(false);
      setSelectedClient(null);
      setAssignTechnicianId("");
      setSelectedContainerIds(new Set());
      // Refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/pm/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/clients-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error?.message || "Failed to assign PMs to technician",
        variant: "destructive",
      });
    },
  });

  // Plan trip mutation (for consolidated trips with services + PM)
  const planTripMutation = useMutation({
    mutationFn: async (params: {
      technicianId: string;
      destinationCity: string;
      startDate: string;
      endDate: string;
      selectedServices?: string[];
      selectedPMTasks?: string[];
    }) => {
      // Use consolidated trip planning if services/PMs are specified, otherwise use regular trip planning
      const endpoint = params.selectedServices?.length || params.selectedPMTasks?.length
        ? "/api/trips/plan-consolidated"
        : "/api/trips/plan";

      const res = await apiRequest("POST", endpoint, params);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to plan trip" }));
        const error: any = new Error(errorData.error || "Failed to plan trip");
        error.response = { data: errorData };
        throw error;
      }
      return await res.json();
    },
    onSuccess: (data) => {
      const isConsolidated = data?.summary?.totalTasks > 0;
      toast({
        title: isConsolidated ? "Consolidated Trip Planned Successfully" : "Trip Planned Successfully",
        description: isConsolidated
          ? `Trip created with ${data.summary.totalTasks} tasks (${data.summary.serviceTasks} services + ${data.summary.pmTasks} PMs)`
          : `Trip created for technician to ${data?.destinationCity || 'destination'}`,
      });
      // Refresh data
      refetchLocationOverview();
      // Switch to travel tab to show the planned trip
      setActiveTab("travel");
      // Refresh planned trips list
      queryClient.invalidateQueries({ queryKey: ["/api/trips/planned"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to plan trip";
      toast({
        title: "Trip Planning Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // PDF Generation for Finance Approval
  const generateTripPDF = useMutation({
    mutationFn: async () => {
      if (!pmPlanData) throw new Error("No trip data available");

      const pdfData = {
        tripData: pmPlanData,
        technician: technicians?.find((t: any) => t.id === pmPlanData.techId),
        selectedTasks: Array.from(selectedPmTaskIds),
        generatedAt: new Date().toISOString(),
        generatedBy: getCurrentUser()?.name || 'System',
      };

      const res = await apiRequest("POST", "/api/trips/generate-finance-pdf", pdfData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate PDF");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      // Prepare data for PDF component
      const technician = technicians?.find((t: any) => t.id === pmPlanData.techId);
      const selectedTasks = Array.from(selectedPmTaskIds);

      // Get service requests (simplified for now - would need proper API call)
      const selectedServiceRequests = []; // Would be populated from API

      // Get PM containers (simplified for now - would need proper API call)
      const pmContainers = pmPlanData.dailyPlan.flatMap((day: any) =>
        day.tasks.filter((task: any) => selectedTasks.includes(task.id) && task.type === 'PM')
          .map((task: any) => ({
            containerCode: task.containerId,
            customerName: 'Customer Name', // Would be populated from API
            pmDetails: {
              lastPmDate: task.lastPmDate,
              daysSincePm: task.daysSincePm,
              pmStatus: task.pmStatus
            }
          }))
      );

      // Calculate wage breakdown using technician wage data
      const serviceRate = technician?.serviceRequestCost || 0;
      const pmRate = technician?.pmCost || 0;

      const wageBreakdown = {
        taskBreakdown: {
          serviceRequests: { count: selectedServiceRequests.length, rate: serviceRate, total: selectedServiceRequests.length * serviceRate },
          pmTasks: { count: pmContainers.length, rate: pmRate, total: pmContainers.length * pmRate }
        },
        allowances: {
          dailyAllowance: {
            rate: (technician?.hotelAllowance || 0) + (technician?.localTravelAllowance || 0),
            days: Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)),
            total: Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)) * ((technician?.hotelAllowance || 0) + (technician?.localTravelAllowance || 0))
          },
          hotelAllowance: { total: Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)) * (technician?.hotelAllowance || 0) },
          localTravelAllowance: { total: Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)) * (technician?.localTravelAllowance || 0) }
        },
        additionalCosts: {
          miscellaneous: { percentage: 5, amount: Math.round((selectedServiceRequests.length * serviceRate + pmContainers.length * pmRate) * 0.05) },
          contingency: { percentage: 3, amount: Math.round((selectedServiceRequests.length * serviceRate + pmContainers.length * pmRate) * 0.03) }
        },
        summary: {
          totalTasks: selectedTasks.length,
          estimatedDays: Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)),
          subtotal: selectedServiceRequests.length * serviceRate + pmContainers.length * pmRate,
          totalAllowance: Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)) * ((technician?.hotelAllowance || 0) + (technician?.localTravelAllowance || 0)),
          totalAdditional: Math.round((selectedServiceRequests.length * serviceRate + pmContainers.length * pmRate) * 0.08),
          totalCost: (selectedServiceRequests.length * serviceRate + pmContainers.length * pmRate) +
                    Math.ceil(selectedTasks.length / (technician?.tasksPerDay || 3)) * ((technician?.hotelAllowance || 0) + (technician?.localTravelAllowance || 0)) +
                    Math.round((selectedServiceRequests.length * serviceRate + pmContainers.length * pmRate) * 0.08)
        }
      };

      setPdfData({
        tripData: pmPlanData,
        technician,
        serviceRequests: selectedServiceRequests,
        pmContainers,
        wageBreakdown,
        generatedAt: new Date().toISOString(),
        generatedBy: getCurrentUser()?.name || 'System'
      });
      setShowPDFPreview(true);

      toast({
        title: "PDF Generated Successfully",
        description: `Finance approval PDF prepared. Preview shown below.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "PDF Generation Failed",
        description: error?.message || "Failed to generate finance PDF",
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
              <TabsList className="grid w-[700px] grid-cols-4">
                <TabsTrigger value="daily">Daily Schedule</TabsTrigger>
                <TabsTrigger value="pm-overview">PM Overview</TabsTrigger>
                <TabsTrigger value="tech-locations" className="gap-1">
                  <Navigation className="h-4 w-4" />
                  Smart Assign
                </TabsTrigger>
                <TabsTrigger value="travel">Travel & Auto PM</TabsTrigger>
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
                        {derivedPendingRequests.length}
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
                <Card
                  key={techSchedule.technician.id}
                  className="card-surface hover:shadow-soft transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedTechnicianId(techSchedule.technician.id);
                    setShowTechnicianDetailsModal(true);
                  }}
                >
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

            {/* PM Overview Tab */}
            <TabsContent value="pm-overview" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  {selectedClient ? (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(null);
                          setSelectedContainerIds(new Set());
                        }}
                        className="gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Clients
                      </Button>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                          <Building2 className="h-6 w-6" />
                          {selectedClient.customerName}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.pendingPm} containers need preventive maintenance
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-foreground">PM Overview</h2>
                      <p className="text-sm text-muted-foreground">
                        View all containers and their preventive maintenance status based on service history
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedClient && clientPmContainers?.success && (
                    <Button
                      onClick={() => setShowAssignDialog(true)}
                      disabled={clientPmContainers.summary.pendingPm === 0}
                      className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    >
                      <Users className="h-4 w-4" />
                      {selectedContainerIds.size > 0 
                        ? `Assign ${selectedContainerIds.size} Selected` 
                        : `Assign All ${clientPmContainers.summary.pendingPm} Pending`}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      refetchPM();
                      refetchPMClients();
                      if (selectedClient) refetchClientPm();
                    }}
                    disabled={pmLoading || pmClientsLoading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${pmLoading || pmClientsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Client Cards Section - Shows when no client is selected */}
              {!selectedClient && pmClientsSummary?.success && pmClientsSummary?.clients?.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Clients with Pending PMs
                    </h3>
                    <Badge variant="outline" className="text-sm">
                      {pmClientsSummary.summary.clientsWithPendingPm} clients • {pmClientsSummary.summary.totalPendingPm} total PMs
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pmClientsSummary.clients
                      .filter((client: any) => client.pendingPm > 0)
                      .map((client: any) => (
                        <Card
                          key={client.customerId}
                          className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-l-4 border-l-orange-500"
                          onClick={() => {
                            setSelectedContainerIds(new Set()); // Clear selections when changing clients
                            setSelectedClient({
                              customerId: client.customerId,
                              customerName: client.customerName,
                              pendingPm: client.pendingPm,
                            });
                          }}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {client.customerName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-2xl font-bold text-orange-500">{client.pendingPm}</span>
                              <span className="text-xs text-muted-foreground">PMs Pending</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {client.neverPm > 0 && (
                                <div className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-center">
                                  {client.neverPm} Never
                                </div>
                              )}
                              {client.overdue > 0 && (
                                <div className="bg-orange-500/10 text-orange-500 px-2 py-1 rounded text-center">
                                  {client.overdue} Overdue
                                </div>
                              )}
                              {client.dueSoon > 0 && (
                                <div className="bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded text-center">
                                  {client.dueSoon} Due Soon
                                </div>
                              )}
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground">
                              {client.totalContainers} total containers • {client.upToDate} up to date
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                  {pmClientsSummary.clients.filter((c: any) => c.pendingPm === 0).length > 0 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      {pmClientsSummary.clients.filter((c: any) => c.pendingPm === 0).length} clients have all PMs up to date
                    </div>
                  )}
                </div>
              )}

              {/* Client-specific container list */}
              {selectedClient && (
                <div className="space-y-4">
                  {clientPmLoading ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">Loading containers...</p>
                      </CardContent>
                    </Card>
                  ) : clientPmContainers?.success ? (
                    <>
                      {/* Summary for selected client */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <Card className="border-l-4 border-l-gray-500">
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold">{clientPmContainers.summary.total}</p>
                            <p className="text-xs text-muted-foreground">Total Containers</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-red-500 bg-red-500/10">
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold text-red-400">{clientPmContainers.summary.never}</p>
                            <p className="text-xs text-muted-foreground">Never PM'd</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-orange-500 bg-orange-500/10">
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold text-orange-400">{clientPmContainers.summary.overdue}</p>
                            <p className="text-xs text-muted-foreground">Overdue (90+ days)</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-yellow-500 bg-yellow-500/10">
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold text-yellow-400">{clientPmContainers.summary.dueSoon}</p>
                            <p className="text-xs text-muted-foreground">Due Soon (75-90 days)</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-green-500 bg-green-500/10">
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold text-green-400">{clientPmContainers.summary.upToDate}</p>
                            <p className="text-xs text-muted-foreground">Up to Date</p>
                          </CardContent>
                        </Card>
                        <Card className={`border-l-4 border-l-blue-500 ${selectedContainerIds.size > 0 ? 'bg-blue-500/20 ring-2 ring-blue-400' : 'bg-blue-500/10'}`}>
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold text-blue-400">{selectedContainerIds.size}</p>
                            <p className="text-xs text-muted-foreground">Selected for PM</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Containers table for selected client */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <Package className="h-5 w-5" />
                              Containers for {selectedClient.customerName}
                              <Badge variant="outline" className="ml-2">
                                {clientPmContainers.summary.pendingPm} need PM
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              {selectedContainerIds.size > 0 && (
                                <Badge className="bg-blue-500 text-white">
                                  {selectedContainerIds.size} selected
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const pendingContainers = clientPmContainers.containers.filter(
                                    (c: any) => c.pmStatus === 'NEVER' || c.pmStatus === 'OVERDUE' || c.pmStatus === 'DUE_SOON'
                                  );
                                  if (selectedContainerIds.size === pendingContainers.length) {
                                    setSelectedContainerIds(new Set());
                                  } else {
                                    setSelectedContainerIds(new Set(pendingContainers.map((c: any) => c.id)));
                                  }
                                }}
                              >
                                {(() => {
                                  const pendingContainers = clientPmContainers.containers.filter(
                                    (c: any) => c.pmStatus === 'NEVER' || c.pmStatus === 'OVERDUE' || c.pmStatus === 'DUE_SOON'
                                  );
                                  return selectedContainerIds.size === pendingContainers.length ? 'Deselect All' : 'Select All Pending';
                                })()}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">Select</TableHead>
                                  <TableHead>Container ID</TableHead>
                                  <TableHead>Location</TableHead>
                                  <TableHead>Last PM Date</TableHead>
                                  <TableHead>Days Since PM</TableHead>
                                  <TableHead>PM Count</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientPmContainers.containers.map((container: any) => {
                                  const needsPm = container.pmStatus === 'NEVER' || container.pmStatus === 'OVERDUE' || container.pmStatus === 'DUE_SOON';
                                  const isSelected = selectedContainerIds.has(container.id);
                                  return (
                                  <TableRow key={container.id} className={`
                                    ${container.pmStatus === 'NEVER' ? 'bg-red-500/5' :
                                    container.pmStatus === 'OVERDUE' ? 'bg-orange-500/5' :
                                    container.pmStatus === 'DUE_SOON' ? 'bg-yellow-500/5' : ''}
                                    ${isSelected ? 'ring-2 ring-blue-400 ring-inset bg-blue-500/10' : ''}
                                  `}>
                                    <TableCell>
                                      {needsPm && (
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={(checked) => {
                                            const newSet = new Set(selectedContainerIds);
                                            if (checked) {
                                              newSet.add(container.id);
                                            } else {
                                              newSet.delete(container.id);
                                            }
                                            setSelectedContainerIds(newSet);
                                          }}
                                        />
                                      )}
                                    </TableCell>
                                    <TableCell className="font-mono font-medium">
                                      {container.containerId}
                                    </TableCell>
                                    <TableCell>{container.depot || '-'}</TableCell>
                                    <TableCell>
                                      {container.lastPmDate 
                                        ? new Date(container.lastPmDate).toLocaleDateString('en-IN', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                          })
                                        : <span className="text-red-400 font-medium">Never</span>}
                                    </TableCell>
                                    <TableCell>
                                      {container.daysSincePm !== null 
                                        ? <span className={container.daysSincePm > 90 ? 'text-orange-400 font-medium' : ''}>
                                            {container.daysSincePm} days
                                          </span>
                                        : <span className="text-red-400">-</span>}
                                    </TableCell>
                                    <TableCell>{container.pmCount || 0}</TableCell>
                                    <TableCell>
                                      <Badge
                                        className={
                                          container.pmStatus === 'NEVER' ? 'bg-red-600' :
                                          container.pmStatus === 'OVERDUE' ? 'bg-orange-600' :
                                          container.pmStatus === 'DUE_SOON' ? 'bg-yellow-600 text-black' :
                                          'bg-green-600'
                                        }
                                      >
                                        {container.pmStatus === 'NEVER' ? 'Never PM\'d' :
                                         container.pmStatus === 'OVERDUE' ? 'Overdue' :
                                         container.pmStatus === 'DUE_SOON' ? 'Due Soon' :
                                         'Up to Date'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                        <p className="text-lg font-medium text-red-400">Error loading client data</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {clientPmContainers?.error || clientPmContainers?.details || 'Unable to fetch containers for this client'}
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => refetchClientPm()}
                          className="mt-4"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Try Again
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* PM Summary Cards - Clickable Filters (only when no client selected) */}
              {!selectedClient && pmOverview?.success && pmOverview?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card 
                    className={`border-l-4 border-l-gray-500 cursor-pointer transition-all hover:scale-[1.02] ${pmFilter === 'all' ? 'ring-2 ring-gray-400 bg-gray-500/20' : 'hover:bg-gray-500/10'}`}
                    onClick={() => setPmFilter('all')}
                  >
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">{pmOverview.summary.total}</p>
                      <p className="text-xs text-muted-foreground">Total Containers</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`border-l-4 border-l-red-500 cursor-pointer transition-all hover:scale-[1.02] ${pmFilter === 'never' ? 'ring-2 ring-red-400 bg-red-500/30' : 'bg-red-500/10 hover:bg-red-500/20'}`}
                    onClick={() => setPmFilter('never')}
                  >
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-red-400">{pmOverview.summary.never}</p>
                      <p className="text-xs text-muted-foreground">Never PM'd</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`border-l-4 border-l-orange-500 cursor-pointer transition-all hover:scale-[1.02] ${pmFilter === 'overdue' ? 'ring-2 ring-orange-400 bg-orange-500/30' : 'bg-orange-500/10 hover:bg-orange-500/20'}`}
                    onClick={() => setPmFilter('overdue')}
                  >
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-orange-400">{pmOverview.summary.overdue}</p>
                      <p className="text-xs text-muted-foreground">Overdue (90+ days)</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`border-l-4 border-l-yellow-500 cursor-pointer transition-all hover:scale-[1.02] ${pmFilter === 'due_soon' ? 'ring-2 ring-yellow-400 bg-yellow-500/30' : 'bg-yellow-500/10 hover:bg-yellow-500/20'}`}
                    onClick={() => setPmFilter('due_soon')}
                  >
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-yellow-400">{pmOverview.summary.dueSoon}</p>
                      <p className="text-xs text-muted-foreground">Due Soon (75-90 days)</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`border-l-4 border-l-green-500 cursor-pointer transition-all hover:scale-[1.02] ${pmFilter === 'up_to_date' ? 'ring-2 ring-green-400 bg-green-500/30' : 'bg-green-500/10 hover:bg-green-500/20'}`}
                    onClick={() => setPmFilter('up_to_date')}
                  >
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-green-400">{pmOverview.summary.upToDate}</p>
                      <p className="text-xs text-muted-foreground">Up to Date</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* PM Containers Table - Only show when no client is selected */}
              {!selectedClient && pmLoading ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading PM data from service history...</p>
                  </CardContent>
                </Card>
              ) : !selectedClient && pmError ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <p className="text-lg font-medium text-red-400">Error loading PM data</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(pmError as any)?.message || 'Unknown error'}
                    </p>
                    <Button onClick={() => refetchPM()} className="mt-4">Retry</Button>
                  </CardContent>
                </Card>
              ) : !selectedClient && pmOverview?.success && pmOverview?.containers?.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Containers {
                        pmFilter === 'all' ? '- All' :
                        pmFilter === 'never' ? '- Never PM\'d' :
                        pmFilter === 'overdue' ? '- Overdue' :
                        pmFilter === 'due_soon' ? '- Due Soon' :
                        pmFilter === 'up_to_date' ? '- Up to Date' :
                        pmFilter === 'needs_pm' ? '- Needing PM' : ''
                      }
                      <Badge variant="outline" className="ml-2">
                        {(() => {
                          const filtered = pmOverview.containers.filter((c: any) => {
                            if (pmFilter === 'all') return true;
                            if (pmFilter === 'needs_pm') return c.pm_status === 'NEVER' || c.pm_status === 'OVERDUE';
                            if (pmFilter === 'overdue') return c.pm_status === 'OVERDUE';
                            if (pmFilter === 'never') return c.pm_status === 'NEVER';
                            if (pmFilter === 'due_soon') return c.pm_status === 'DUE_SOON';
                            if (pmFilter === 'up_to_date') return c.pm_status === 'UP_TO_DATE';
                            return true;
                          });
                          return `${filtered.length} containers`;
                        })()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Container ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Last PM Date</TableHead>
                            <TableHead>Days Since PM</TableHead>
                            <TableHead>Total PM Count</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pmOverview.containers
                            .filter((c: any) => {
                              if (pmFilter === 'all') return true;
                              if (pmFilter === 'needs_pm') return c.pm_status === 'NEVER' || c.pm_status === 'OVERDUE';
                              if (pmFilter === 'overdue') return c.pm_status === 'OVERDUE';
                              if (pmFilter === 'never') return c.pm_status === 'NEVER';
                              if (pmFilter === 'due_soon') return c.pm_status === 'DUE_SOON';
                              if (pmFilter === 'up_to_date') return c.pm_status === 'UP_TO_DATE';
                              return true;
                            })
                            .slice(0, 100)
                            .map((container: any) => (
                            <TableRow key={container.id} className={
                              container.pm_status === 'NEVER' ? 'bg-red-500/5' :
                              container.pm_status === 'OVERDUE' ? 'bg-orange-500/5' :
                              ''
                            }>
                              <TableCell className="font-mono font-medium">
                                {container.container_id}
                              </TableCell>
                              <TableCell>{container.customer_name || '-'}</TableCell>
                              <TableCell>{container.depot || '-'}</TableCell>
                              <TableCell>
                                {container.last_pm_date 
                                  ? new Date(container.last_pm_date).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : <span className="text-red-400 font-medium">Never</span>}
                              </TableCell>
                              <TableCell>
                                {container.days_since_pm !== null 
                                  ? <span className={container.days_since_pm > 90 ? 'text-orange-400 font-medium' : ''}>
                                      {Math.round(container.days_since_pm)} days
                                    </span>
                                  : <span className="text-red-400">-</span>}
                              </TableCell>
                              <TableCell>{container.pm_count || 0}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    container.pm_status === 'NEVER' ? 'destructive' :
                                    container.pm_status === 'OVERDUE' ? 'destructive' :
                                    container.pm_status === 'DUE_SOON' ? 'secondary' :
                                    'default'
                                  }
                                  className={
                                    container.pm_status === 'NEVER' ? 'bg-red-600' :
                                    container.pm_status === 'OVERDUE' ? 'bg-orange-600' :
                                    container.pm_status === 'DUE_SOON' ? 'bg-yellow-600 text-black' :
                                    'bg-green-600'
                                  }
                                >
                                  {container.pm_status === 'NEVER' ? 'Never PM\'d' :
                                   container.pm_status === 'OVERDUE' ? `Overdue (${Math.round(container.days_since_pm)}d)` :
                                   container.pm_status === 'DUE_SOON' ? 'Due Soon' :
                                   'Up to Date'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {(container.pm_status === 'NEVER' || container.pm_status === 'OVERDUE' || container.pm_status === 'DUE_SOON') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => {
                                      setSelectedPmContainer({
                                        containerId: container.id,
                                        containerCode: container.container_id,
                                        depot: container.depot || '',
                                        customerName: container.customer_name || '',
                                        daysSincePm: container.days_since_pm,
                                      });
                                      setActiveTab("travel");
                                      toast({
                                        title: "Schedule PM",
                                        description: `Navigate to Travel & Auto PM to schedule PM for ${container.container_id}${container.depot ? ` in ${container.depot}` : ''}`,
                                      });
                                    }}
                                  >
                                    <Plane className="h-3 w-3" />
                                    Schedule PM
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(() => {
                      const filtered = pmOverview.containers.filter((c: any) => {
                        if (pmFilter === 'all') return true;
                        if (pmFilter === 'needs_pm') return c.pm_status === 'NEVER' || c.pm_status === 'OVERDUE';
                        if (pmFilter === 'overdue') return c.pm_status === 'OVERDUE';
                        if (pmFilter === 'never') return c.pm_status === 'NEVER';
                        if (pmFilter === 'due_soon') return c.pm_status === 'DUE_SOON';
                        if (pmFilter === 'up_to_date') return c.pm_status === 'UP_TO_DATE';
                        return true;
                      });
                      return filtered.length > 100 ? (
                        <p className="text-sm text-muted-foreground mt-4 text-center">
                          Showing first 100 of {filtered.length} containers
                        </p>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              ) : !selectedClient ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium">No PM data available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PM data is loaded from service history. Click "Refresh" to load the data.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* Smart Assign / Tech Locations Tab */}
            <TabsContent value="tech-locations" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
                    <Navigation className="h-6 w-6 text-blue-500" />
                    Smart Assign
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Click on a technician to see PM recommendations for their location
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchLocationOverview()}
                  disabled={locationLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${locationLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {locationLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : locationOverview?.success ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Technician List */}
                  <div className="lg:col-span-1 space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Technicians ({locationOverview.technicians?.length || 0})
                    </h3>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                      {locationOverview.technicians?.map((tech: any) => (
                        <Card 
                          key={tech.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedTechForSmartPlan?.id === tech.id 
                              ? 'ring-2 ring-blue-500 bg-blue-500/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedTechForSmartPlan(
                            selectedTechForSmartPlan?.id === tech.id ? null : tech
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                {tech.name?.charAt(0) || 'T'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{tech.name}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{tech.baseLocation || 'Unknown'}</span>
                                </div>
                              </div>
                              {tech.nextService && (
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-xs text-green-500">
                                    <Navigation className="h-3 w-3" />
                                    <span>{tech.nextService.city}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            {tech.assignedServices?.total > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {tech.assignedServices.total} services
                                </Badge>
                                {Object.keys(tech.pmRecommendations || {}).length > 0 && (
                                  <Badge className="text-xs bg-orange-500/20 text-orange-400">
                                    {Object.values(tech.pmRecommendations || {}).reduce((a: number, b: any) => a + (b.count || 0), 0)} PM nearby
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Right: Selected Technician Details & PM Recommendations */}
                  <div className="lg:col-span-2">
                    {selectedTechForSmartPlan ? (
                      <Card className="h-full">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                {selectedTechForSmartPlan.name?.charAt(0) || 'T'}
                              </div>
                              <div>
                                <CardTitle>{selectedTechForSmartPlan.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{selectedTechForSmartPlan.employeeCode}</p>
                              </div>
                            </div>
                            <Badge className={selectedTechForSmartPlan.status === 'available' ? 'bg-green-500' : ''}>
                              {selectedTechForSmartPlan.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Location Info */}
                          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="text-xs text-muted-foreground">Current Location</p>
                              <p className="font-medium flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-blue-500" />
                                {selectedTechForSmartPlan.baseLocation || 'Unknown'}
                              </p>
                            </div>
                            {selectedTechForSmartPlan.nextService && (
                              <div>
                                <p className="text-xs text-muted-foreground">Next Service</p>
                                <p className="font-medium flex items-center gap-1">
                                  <Navigation className="h-4 w-4 text-green-500" />
                                  {selectedTechForSmartPlan.nextService.city}
                                  <span className="text-xs text-muted-foreground">
                                    ({selectedTechForSmartPlan.nextService.requestNumber})
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Clients by City */}
                          {Object.keys(selectedTechForSmartPlan.assignedServices?.cityClients || {}).length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-orange-500" />
                                Clients by City
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(selectedTechForSmartPlan.assignedServices?.cityClients || {}).map(([city, clients]: [string, any]) => {
                                  const services = selectedTechForSmartPlan.assignedServices?.byCity?.[city] || [];

                                  return (
                                    <div
                                      key={city}
                                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                                        selectedCityForPlan === city ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
                                      }`}
                                      onClick={() => setSelectedCityForPlan(selectedCityForPlan === city ? "" : city)}
                                      title={`${clients.join(', ')} — ${city}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="space-y-1">
                                            {clients.map((client: string, index: number) => (
                                              <span key={index} className="font-medium text-sm block truncate" title={`${client} — ${city}`}>
                                                {client} — {city}
                                              </span>
                                            ))}
                                          </div>
                                          <span className="text-xs text-muted-foreground mt-1 block">
                                            {services.length} service{services.length !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <Badge variant="outline" className="flex-shrink-0">{services.length}</Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* PM Recommendations */}
                          {Object.keys(selectedTechForSmartPlan.pmRecommendations || {}).length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                <Target className="h-4 w-4 text-red-500" />
                                PM Recommendations by City (Click city to view PMs)
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(selectedTechForSmartPlan.pmRecommendations || {}).map(([city, pm]: [string, any]) => (
                                  <div
                                    key={city}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                                      selectedCityForPlan === city
                                        ? 'ring-2 ring-orange-500 bg-orange-500/10 border-orange-500'
                                        : 'hover:bg-orange-500/5'
                                    }`}
                                    onClick={() => setSelectedCityForPlan(selectedCityForPlan === city ? "" : city)}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">{city}</span>
                                      <Badge className="bg-orange-500">{pm.count} PM</Badge>
                                    </div>
                                    <div className="flex gap-2 text-xs">
                                      {pm.overdue > 0 && <span className="text-red-400">{pm.overdue} overdue</span>}
                                      {pm.never > 0 && <span className="text-orange-400">{pm.never} never</span>}
                                      {pm.dueSoon > 0 && <span className="text-yellow-400">{pm.dueSoon} due soon</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* PM Details for Selected City */}
                              {selectedCityForPlan && selectedTechForSmartPlan.pmRecommendations?.[selectedCityForPlan] && (
                                <div className="mt-4 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-medium text-sm flex items-center gap-2">
                                      <Target className="h-4 w-4 text-orange-500" />
                                      PM Tasks in {selectedCityForPlan}
                                    </h5>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const allContainers = selectedTechForSmartPlan.pmRecommendations[selectedCityForPlan].containers || [];
                                          const allIds = allContainers.map((c: any) => c.id);
                                          if (selectedPmTaskIds.size === allIds.length) {
                                            setSelectedPmTaskIds(new Set());
                                          } else {
                                            setSelectedPmTaskIds(new Set(allIds));
                                          }
                                        }}
                                        className="text-xs h-7"
                                      >
                                        {selectedPmTaskIds.size === (selectedTechForSmartPlan.pmRecommendations[selectedCityForPlan].containers || []).length
                                          ? "Deselect All"
                                          : "Select All"}
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Group PM tasks by client */}
                                  <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {(() => {
                                      const containers = selectedTechForSmartPlan.pmRecommendations[selectedCityForPlan].containers || [];
                                      const clientsMap = new Map<string, any[]>();

                                      // Group containers by client
                                      containers.forEach((container: any) => {
                                        const clientName = container.customerName || 'Unknown Client';
                                        if (!clientsMap.has(clientName)) {
                                          clientsMap.set(clientName, []);
                                        }
                                        clientsMap.get(clientName)!.push(container);
                                      });

                                      return Array.from(clientsMap.entries()).map(([clientName, clientContainers]) => {
                                        const clientSelectedCount = clientContainers.filter(c => selectedPmTaskIds.has(c.id)).length;
                                        const isClientFullySelected = clientSelectedCount === clientContainers.length;
                                        const isClientPartiallySelected = clientSelectedCount > 0 && clientSelectedCount < clientContainers.length;

                                        return (
                                          <div key={clientName} className="border rounded-lg p-3">
                                            <div className="flex items-center gap-3 mb-2">
                                              <Checkbox
                                                checked={isClientFullySelected}
                                                indeterminate={isClientPartiallySelected}
                                                onCheckedChange={(checked) => {
                                                  const newSet = new Set(selectedPmTaskIds);
                                                  if (checked) {
                                                    // Select all containers for this client
                                                    clientContainers.forEach(c => newSet.add(c.id));
                                                  } else {
                                                    // Deselect all containers for this client
                                                    clientContainers.forEach(c => newSet.delete(c.id));
                                                  }
                                                  setSelectedPmTaskIds(newSet);
                                                }}
                                              />
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-sm">{clientName}</span>
                                                  <Badge variant="outline" className="text-xs">
                                                    {clientContainers.length} container{clientContainers.length !== 1 ? 's' : ''}
                                                  </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {clientSelectedCount} of {clientContainers.length} selected
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="text-sm font-medium">₹{(clientContainers.length * (selectedTechForSmartPlan?.pmCost || 0)).toLocaleString('en-IN')}</div>
                                                <div className="text-xs text-muted-foreground">est.</div>
                                              </div>
                                            </div>

                                            {/* Show containers for this client */}
                                            <div className="ml-8 space-y-1">
                                              {clientContainers.map((container: any) => (
                                                <div
                                                  key={container.id}
                                                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                                                    selectedPmTaskIds.has(container.id) ? 'bg-orange-50 dark:bg-orange-950/30' : 'opacity-75'
                                                  }`}
                                                >
                                                  <Checkbox
                                                    checked={selectedPmTaskIds.has(container.id)}
                                                    onCheckedChange={(checked) => {
                                                      const newSet = new Set(selectedPmTaskIds);
                                                      if (checked) {
                                                        newSet.add(container.id);
                                                      } else {
                                                        newSet.delete(container.id);
                                                      }
                                                      setSelectedPmTaskIds(newSet);
                                                    }}
                                                  />
                                                  <span className="font-mono text-xs">{container.containerCode}</span>
                                                  <Badge
                                                    variant={
                                                      container.pmStatus === 'OVERDUE' ? 'destructive' :
                                                      container.pmStatus === 'NEVER' ? 'destructive' :
                                                      container.pmStatus === 'DUE_SOON' ? 'secondary' : 'outline'
                                                    }
                                                    className="text-xs"
                                                  >
                                                    {container.pmStatus === 'OVERDUE' ? 'Overdue' :
                                                     container.pmStatus === 'NEVER' ? 'Never Done' :
                                                     container.pmStatus === 'DUE_SOON' ? 'Due Soon' : 'Up to Date'}
                                                  </Badge>
                                                  <span className="text-xs text-muted-foreground ml-auto">
                                                    {container.daysSincePm ? `${container.daysSincePm}d ago` : 'Never'}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>

                                  {selectedPmTaskIds.size > 0 && (
                                    <div className="mt-3 pt-3 border-t">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">
                                          {selectedPmTaskIds.size} PM task{selectedPmTaskIds.size !== 1 ? 's' : ''} selected
                                        </span>
                                        <span className="font-medium">
                                          ₹{(selectedPmTaskIds.size * (selectedTechForSmartPlan?.pmCost || 0)).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Consolidated Trip Planning Card */}
                          {selectedCityForPlan && (
                            <div className="pt-4 border-t">
                              <ConsolidatedTripCard
                                technician={selectedTechForSmartPlan}
                                city={selectedCityForPlan}
                                assignedServices={selectedTechForSmartPlan.assignedServices?.byCity?.[selectedCityForPlan] || []}
                                pmTasks={selectedTechForSmartPlan.pmRecommendations?.[selectedCityForPlan]?.containers || []}
                                onPlanTrip={(params) => {
                                  setAutoPlanParams(params);
                                  setActiveTab("travel");
                                  toast({
                                    title: "Planning consolidated trip...",
                                    description: `Creating trip for ${selectedTechForSmartPlan.name} to ${selectedCityForPlan}`,
                                  });
                                  planTripMutation.mutate(params);
                                }}
                              />
                            </div>
                          )}

                          {!selectedCityForPlan && Object.keys(selectedTechForSmartPlan.pmRecommendations || {}).length > 0 && (
                            <Alert className="border-blue-500/50 bg-blue-500/5">
                              <Zap className="h-4 w-4" />
                              <AlertDescription>
                                Click on a city above to see service + PM details and plan a combined trip
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="h-full flex items-center justify-center">
                        <CardContent className="text-center py-12">
                          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                          <h3 className="font-medium text-lg mb-2">Select a Technician</h3>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            Click on a technician from the list to see their location, assigned services, and PM recommendations
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Failed to load technician location data</p>
                    <Button variant="outline" className="mt-4" onClick={() => refetchLocationOverview()}>
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Technician Travel Tab */}
            <TabsContent value="travel" className="space-y-6 mt-6">
              {/* Planned Trips Section */}
              <PlannedTripsList onTripSelected={(tripId) => {
                // Could navigate to trip details or show in dialog
                toast({
                  title: "Trip Selected",
                  description: `Selected trip ${tripId}`,
                });
              }} />

              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Plan New Trip</h2>
                <p className="text-sm text-muted-foreground">
                  Generate trips automatically, review costs and PM tasks, then save in one click.
                </p>
              </div>

              {/* Selected PM Container Banner */}
              {selectedPmContainer && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <Plane className="h-4 w-4 text-blue-400" />
                  <AlertTitle className="text-blue-400">Scheduling PM for Container</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-mono font-bold">{selectedPmContainer.containerCode}</span>
                      {selectedPmContainer.customerName && <span> • {selectedPmContainer.customerName}</span>}
                      {selectedPmContainer.depot && <span> • Location: <strong>{selectedPmContainer.depot}</strong></span>}
                      {selectedPmContainer.daysSincePm !== null && (
                        <span className="text-orange-400 ml-2">
                          ({Math.round(selectedPmContainer.daysSincePm)} days since last PM)
                        </span>
                      )}
                      {selectedPmContainer.daysSincePm === null && (
                        <span className="text-red-400 ml-2">(Never had PM)</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedPmContainer(null)}
                    >
                      Clear
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* PDF Preview */}
              {showPDFPreview && pdfData && (
                <div className="mb-6">
                  <TripFinancePDF
                    tripData={pmPlanData}
                    technician={technicians?.find((t: any) => t.id === pmPlanData.techId)}
                    serviceRequests={[]} // Would need to be populated from selected tasks
                    pmContainers={[]} // Would need to be populated from selected tasks
                    wageBreakdown={pdfData?.metadata || {}}
                    generatedAt={pdfData?.metadata?.generatedAt || new Date().toISOString()}
                    generatedBy={pdfData?.metadata?.generatedBy || 'System'}
                    onClose={() => setShowPDFPreview(false)}
                  />
                </div>
              )}

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
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-muted-foreground">Daily Schedule</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {selectedPmTaskIds.size} of {pmPlanData.dailyPlan.reduce((acc, day) => acc + day.tasks.length, 0)} selected
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const allTaskIds = new Set<string>();
                              pmPlanData.dailyPlan.forEach(day => {
                                day.tasks.forEach(task => {
                                  if (task.id) allTaskIds.add(task.id);
                                });
                              });
                              if (selectedPmTaskIds.size === allTaskIds.size) {
                                setSelectedPmTaskIds(new Set());
                              } else {
                                setSelectedPmTaskIds(allTaskIds);
                              }
                            }}
                            className="text-xs h-7"
                          >
                            {selectedPmTaskIds.size === pmPlanData.dailyPlan.reduce((acc, day) => acc + day.tasks.length, 0) 
                              ? "Deselect All" 
                              : "Select All"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {pmPlanData.dailyPlan.map((day, idx) => {
                          const dayTaskIds = day.tasks.map(t => t.id);
                          const selectedCount = dayTaskIds.filter(id => selectedPmTaskIds.has(id)).length;
                          return (
                            <div key={idx} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedCount === day.tasks.length}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(selectedPmTaskIds);
                                      day.tasks.forEach(task => {
                                        if (checked) {
                                          newSet.add(task.id);
                                        } else {
                                          newSet.delete(task.id);
                                        }
                                      });
                                      setSelectedPmTaskIds(newSet);
                                    }}
                                  />
                                  <span className="font-medium">
                                    {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                <Badge variant="outline">{selectedCount}/{day.tasks.length} tasks</Badge>
                              </div>
                              <div className="space-y-1 ml-6">
                                {day.tasks.map((task, taskIdx) => (
                                  <div 
                                    key={taskIdx} 
                                    className={`flex items-center gap-2 text-sm p-1 rounded ${
                                      selectedPmTaskIds.has(task.id) ? 'bg-orange-50 dark:bg-orange-950/20' : 'opacity-50'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={selectedPmTaskIds.has(task.id)}
                                      onCheckedChange={(checked) => {
                                        const newSet = new Set(selectedPmTaskIds);
                                        if (checked) {
                                          newSet.add(task.id);
                                        } else {
                                          newSet.delete(task.id);
                                        }
                                        setSelectedPmTaskIds(newSet);
                                      }}
                                    />
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
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => confirmTripMutation.mutate()}
                        disabled={confirmTripMutation.isPending || selectedPmTaskIds.size === 0}
                        className="flex-1 gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {confirmTripMutation.isPending 
                          ? "Confirming..." 
                          : `Confirm & Send (${selectedPmTaskIds.size} PMs)`}
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

          {/* Bulk PM Assignment Dialog */}
          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Assign PMs to Technician
                </DialogTitle>
                <DialogDescription>
                  {selectedContainerIds.size > 0 
                    ? `Assign ${selectedContainerIds.size} selected containers for PM to a technician`
                    : `Assign all ${clientPmContainers?.summary?.pendingPm || 0} pending PMs for ${selectedClient?.customerName} to a technician`}
                </DialogDescription>
              </DialogHeader>
              {selectedClient && (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-950/20">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Client:</span>
                        <span className="font-bold">{selectedClient.customerName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Containers to Assign:</span>
                        <Badge variant={selectedContainerIds.size > 0 ? "default" : "destructive"} className={selectedContainerIds.size > 0 ? "bg-blue-500" : ""}>
                          {selectedContainerIds.size > 0 
                            ? `${selectedContainerIds.size} selected`
                            : `${clientPmContainers?.summary?.pendingPm || 0} all pending`}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Show selected containers if any */}
                  {selectedContainerIds.size > 0 && clientPmContainers?.containers && (
                    <div className="rounded-lg border p-3 max-h-32 overflow-y-auto bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Selected Containers:</p>
                      <div className="flex flex-wrap gap-1">
                        {clientPmContainers.containers
                          .filter((c: any) => selectedContainerIds.has(c.id))
                          .map((c: any) => (
                            <Badge key={c.id} variant="outline" className="text-xs font-mono">
                              {c.containerId}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign-technician">Select Technician</Label>
                    <Select value={assignTechnicianId} onValueChange={setAssignTechnicianId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a technician..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Internal Technicians */}
                        {technicians && technicians.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                              Internal Technicians
                            </div>
                            {technicians.map((tech: any) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                  {tech.name || tech.employeeCode} {tech.baseLocation ? `(${typeof tech.baseLocation === 'string' ? tech.baseLocation : tech.baseLocation?.city || ''})` : ''}
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {/* Third-Party Technicians */}
                        {thirdPartyTechnicians && thirdPartyTechnicians.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1 border-t">
                              Third-Party Technicians
                            </div>
                            {thirdPartyTechnicians.map((tech: any) => (
                              <SelectItem key={`tp-${tech.id}`} value={`thirdparty:${tech.id}`}>
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                                  {tech.name || tech.contactName} {tech.baseLocation ? `(${tech.baseLocation})` : ''}
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign-date">Scheduled Date</Label>
                    <input
                      type="date"
                      id="assign-date"
                      value={assignDate}
                      onChange={(e) => setAssignDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignDialog(false);
                    setAssignTechnicianId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedClient && assignTechnicianId) {
                      bulkAssignPMMutation.mutate({
                        customerId: selectedClient.customerId,
                        technicianId: assignTechnicianId,
                        scheduledDate: assignDate,
                        containerIds: selectedContainerIds.size > 0 ? Array.from(selectedContainerIds) : undefined,
                      });
                    }
                  }}
                  disabled={!assignTechnicianId || bulkAssignPMMutation.isPending}
                  className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600"
                >
                  {bulkAssignPMMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Assign {selectedContainerIds.size > 0 ? selectedContainerIds.size : (clientPmContainers?.summary?.pendingPm || 0)} PMs
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

      {/* Technician Trip Details Modal */}
      <TechnicianTripDetailsModal
        isOpen={showTechnicianDetailsModal}
        onClose={() => {
          setShowTechnicianDetailsModal(false);
          setSelectedTechnicianId(null);
        }}
        technicianId={selectedTechnicianId || ""}
      />
    </div>
  );
}
