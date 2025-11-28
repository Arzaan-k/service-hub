import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { MapPin, Phone, Star, Wrench, ArrowLeft, Edit, Save, X, Clock, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MapMyIndiaAutocomplete from "@/components/map-my-india-autocomplete";
import { websocket } from "@/lib/websocket";

function formatDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString();
}

function ElapsedTime({ startTime }: { startTime: string | Date | null | undefined }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startTime) return;

    const updateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diffMs = now - start;
      const diffMins = Math.floor(diffMs / 60000);

      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;

      if (hours > 0) {
        setElapsed(`${hours}h ${minutes}m`);
      } else {
        setElapsed(`${minutes}m`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
      <Clock className="w-3 h-3" />
      <span>Elapsed: {elapsed}</span>
    </div>
  );
}

export default function TechnicianProfile() {
  const [, params] = useRoute("/technicians/:id");
  const technicianId = params?.id as string;

  const { data: technician, isLoading: isTechLoading, error: techError } = useQuery({
    queryKey: ["/api/technicians", technicianId],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}`)).json(),
    enabled: !!technicianId,
  });

  useEffect(() => {
    if (techError) console.error("[Technician Profile] Failed to fetch technician:", techError);
  }, [techError]);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const isoDate = `${yyyy}-${mm}-${dd}`;

  const { data: schedule, isLoading: isScheduleLoading, error: scheduleError } = useQuery({
    queryKey: ["/api/technicians", technicianId, "schedule", isoDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/technicians/${technicianId}/schedule?date=${isoDate}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch schedule: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!technicianId,
  });

  useEffect(() => {
    if (scheduleError) console.error("[Technician Profile] Failed to fetch schedule:", scheduleError);
  }, [scheduleError]);

  const queryClient = useQueryClient();

  const { data: requestsData, isLoading: isRequestsLoading, error: requestsError, refetch: refetchRequests } = useQuery({
    queryKey: ["/api/service-requests/technician", technicianId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests/technician/${technicianId}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch services: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      console.log('[Technician Assigned Services]', technicianId, data);
      
      // Use active services if available, otherwise use all
      const assigned = data?.active || data?.all || [];
      
      console.log(`[Technician Profile] Fetched services for tech ${technicianId}:`, {
        total: data?.all?.length || 0,
        active: data?.active?.length || 0,
        completed: data?.completed?.length || 0,
        cancelled: data?.cancelled?.length || 0,
        assigned: assigned.length,
        dataType: typeof data,
        isArray: Array.isArray(data),
        hasActive: !!data?.active,
        hasAll: !!data?.all
      });
      
      return {
        active: data?.active || [],
        completed: data?.completed || [],
        cancelled: data?.cancelled || [],
        all: data?.all || [],
        assigned // For backward compatibility
      };
    },
    enabled: !!technicianId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue refetching even when tab is not active
  });

  // Listen for service assignment events to refresh assigned services
  useEffect(() => {
    if (!refetchRequests) return;
    
    const handleServiceAssigned = (data: any) => {
      // Check if this assignment is for the current technician
      const assignedTechId = data?.assignedTechnicianId || data?.data?.assignedTechnicianId;
      if (assignedTechId === technicianId) {
        console.log(`[Technician Profile] Service assigned to this technician (${technicianId}), refetching...`);
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
        refetchRequests();
      }
    };

    websocket.on("service_request_assigned", handleServiceAssigned);
    websocket.on("service_request_updated", handleServiceAssigned);

    return () => {
      websocket.off("service_request_assigned", handleServiceAssigned);
      websocket.off("service_request_updated", handleServiceAssigned);
    };
  }, [technicianId, refetchRequests, queryClient]);

  useEffect(() => {
    if (requestsError) console.error("[Technician Profile] Failed to fetch service requests:", requestsError);
  }, [requestsError]);

  // Third-party assigned services
  const { data: tpRequests, isLoading: isTpRequestsLoading, error: tpRequestsError } = useQuery({
    queryKey: ["/api/services-by-technician", technicianId, "thirdparty"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/services-by-technician/${technicianId}?type=thirdparty`);
      if (!res.ok) {
        throw new Error(`Failed to fetch third-party services: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!technicianId,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (tpRequestsError) console.error("[Technician Profile] Failed to fetch third-party services:", tpRequestsError);
  }, [tpRequestsError]);

  // Service History - separate query for completed services
  const { data: serviceHistory, isLoading: isHistoryLoading, error: historyError } = useQuery({
    queryKey: ["/api/technicians", technicianId, "service-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/technicians/${technicianId}/service-history`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch service history: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      console.log(`[Technician Profile] Fetched service history for tech ${technicianId}:`, {
        count: Array.isArray(data) ? data.length : 0,
        isArray: Array.isArray(data),
        dataType: typeof data,
        data: data
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!technicianId,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (historyError) console.error("[Technician Profile] Failed to fetch service history:", historyError);
  }, [historyError]);

  const { data: performance, error: performanceError } = useQuery({
    queryKey: ["/api/technicians", technicianId, "performance"],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/performance`)).json(),
    enabled: !!technicianId,
  });

  useEffect(() => {
    if (performanceError) console.error("[Technician Profile] Failed to fetch performance:", performanceError);
  }, [performanceError]);

  // Wage details (editable)
  const { data: wageData, isLoading: isWageLoading, error: wageError } = useQuery({
    queryKey: ["/api/technicians", technicianId, "wage"],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/wage`)).json(),
    enabled: !!technicianId,
  });

  useEffect(() => {
    if (wageError) console.error("[Technician Profile] Failed to fetch wage data:", wageError);
  }, [wageError]);

  // Global Debug Log - MUST run on every load
  useEffect(() => {
    console.log("[Technician Profile Debug]", {
      technicianId,
      technician: technician ? { id: (technician as any).id, name: (technician as any).name, type: (technician as any).type } : null,
      schedule: schedule ? { count: Array.isArray(schedule) ? schedule.length : 0, isArray: Array.isArray(schedule), data: schedule } : null,
      requests: requestsData ? { 
        count: requestsData.assigned?.length || requestsData.active?.length || requestsData.all?.length || 0, 
        active: requestsData.active?.length || 0,
        completed: requestsData.completed?.length || 0,
        cancelled: requestsData.cancelled?.length || 0,
        all: requestsData.all?.length || 0,
        data: requestsData 
      } : null,
      tpRequests: tpRequests ? { count: Array.isArray(tpRequests) ? tpRequests.length : 0, isArray: Array.isArray(tpRequests), data: tpRequests } : null,
      performance: performance ? { totalServices: (performance as any).totalServices, averageRating: (performance as any).averageRating } : null,
      wageData: wageData ? { hotelAllowance: (wageData as any).hotelAllowance, foodAllowance: (wageData as any).foodAllowance } : null,
      errors: {
        techError: techError ? String(techError) : null,
        scheduleError: scheduleError ? String(scheduleError) : null,
        requestsError: requestsError ? String(requestsError) : null,
        tpRequestsError: tpRequestsError ? String(tpRequestsError) : null,
        performanceError: performanceError ? String(performanceError) : null,
        wageError: wageError ? String(wageError) : null,
      },
      loading: {
        isTechLoading,
        isScheduleLoading,
        isRequestsLoading,
        isTpRequestsLoading,
        isWageLoading,
      }
    });
  }, [technicianId, technician, schedule, requestsData, tpRequests, performance, wageData, techError, scheduleError, requestsError, tpRequestsError, performanceError, wageError, isTechLoading, isScheduleLoading, isRequestsLoading, isTpRequestsLoading, isWageLoading]);

  const [wageEditMode, setWageEditMode] = useState(false);
  const [wageForm, setWageForm] = useState<any>({
    grade: "",
    designation: "",
    hotelAllowance: 0,
    localTravelAllowance: 0,
    foodAllowance: 0,
    personalAllowance: 0,
    moneyAllowance: "", // for third-party parity (UI-only here)
  });
  const isThirdParty = (technician as any)?.type === "thirdparty";
  useEffect(() => {
    if (wageData && wageEditMode) {
      setWageForm({
        grade: wageData.grade ?? "",
        designation: wageData.designation ?? "",
        hotelAllowance: wageData.hotelAllowance ?? 0,
        localTravelAllowance: wageData.localTravelAllowance ?? 0,
        foodAllowance: wageData.foodAllowance ?? 0,
        personalAllowance: wageData.personalAllowance ?? 0,
        moneyAllowance: (technician as any)?.moneyAllowance ?? "",
      });
    }
  }, [wageData, wageEditMode, technician]);

  const updateWage = useMutation({
    mutationFn: async () => {
      const payload = {
        grade: wageForm.grade,
        designation: wageForm.designation,
        hotelAllowance: Number(wageForm.hotelAllowance) || 0,
        localTravelAllowance: Number(wageForm.localTravelAllowance) || 0,
        foodAllowance: Number(wageForm.foodAllowance) || 0,
        personalAllowance: Number(wageForm.personalAllowance) || 0,
      };
      const res = await apiRequest("PUT", `/api/technicians/${technicianId}/wage`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "wage"] });
      setWageEditMode(false);
      toast({ title: "Saved", description: "Wage details updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update wage details", variant: "destructive" });
    }
  });

  const updateThirdParty = useMutation({
    mutationFn: async () => {
      const money = wageForm.moneyAllowance === "" ? undefined : Number(wageForm.moneyAllowance);
      if (money === undefined || Number.isNaN(money)) {
        throw new Error("Enter a valid money allowance");
      }
      const res = await apiRequest("PUT", `/api/thirdparty-technicians/${technicianId}`, { moneyAllowance: money });
      return await res.json();
    },
    onSuccess: () => {
      // Refetch technician to reflect updated allowance (served from file-backed list normalization)
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId] });
      setWageEditMode(false);
      toast({ title: "Saved", description: "Money allowance updated successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to update money allowance", variant: "destructive" });
    }
  });

  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ baseLocation: "" });

  // Initialize edit form when technician data is available
  useEffect(() => {
    if (technician) {
      const locationValue = typeof technician.baseLocation === "string"
        ? technician.baseLocation
        : technician.baseLocation?.city || "";
      setEditForm({
        baseLocation: locationValue,
      });
    }
  }, [technician]);
  const [isCredentialsConfirmOpen, setIsCredentialsConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    const onServiceRequestAssigned = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "schedule"] });
    };

    const onServiceRequestStarted = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "schedule"] });
    };

    const onServiceRequestCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "performance"] });
    };

    websocket.on("service_request_assigned", onServiceRequestAssigned);
    websocket.on("service_request_started", onServiceRequestStarted);
    websocket.on("service_request_completed", onServiceRequestCompleted);

    return () => {
      websocket.off("service_request_assigned", onServiceRequestAssigned);
      websocket.off("service_request_started", onServiceRequestStarted);
      websocket.off("service_request_completed", onServiceRequestCompleted);
    };
  }, [queryClient, technicianId]);

  const updateTechnician = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/technicians/${technicianId}`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update technician");
      }
      return await res.json();
    },
    onSuccess: async () => {
      // Invalidate all related queries to ensure UI updates everywhere
      await queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/technicians/location-overview"] });
      // Refetch immediately to ensure fresh data
      await queryClient.refetchQueries({ queryKey: ["/api/technicians", technicianId] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Technician location updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update technician profile",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/technicians/${technicianId}/reset-password`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send password reset');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Show link in toast if email failed or in development
      const message = data.emailSent
        ? "Password reset email sent successfully to the technician."
        : "Password reset link generated. Email delivery failed - check server logs.";

      toast({
        title: data.emailSent ? "Email Sent" : "Link Generated",
        description: message,
      });

      // Log reset link for development
      if (data.resetLink) {
        console.log('🔗 Technician password reset link:', data.resetLink);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirmResetPassword = () => {
    resetPasswordMutation.mutate();
    setIsCredentialsConfirmOpen(false);
  };

  const deleteTechnicianMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/technicians/${technicianId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to delete technician');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "Technician Deleted",
        description: "The technician has been successfully deleted.",
      });
      // Navigate back to technicians list
      window.location.href = "/technicians";
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirmDelete = () => {
    deleteTechnicianMutation.mutate();
    setIsDeleteConfirmOpen(false);
  };

  // Update edit form when entering edit mode
  useEffect(() => {
    if (technician && isEditing) {
      const locationValue = typeof technician.baseLocation === "string"
        ? technician.baseLocation
        : technician.baseLocation?.city || "";
      setEditForm({
        baseLocation: locationValue,
      });
    }
  }, [technician, isEditing]);

  // Don't block rendering - always show UI even if data is loading or missing

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Technician Profile" />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/technicians"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          </div>

          <Card>
            <CardHeader className="pb-3">
              {isTechLoading ? (
                <div className="text-sm text-muted-foreground">Loading technician...</div>
              ) : techError || !technician ? (
                <div className="text-destructive">Failed to load technician. {techError ? String(techError) : ""}</div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{technician.name || "Unknown Technician"}</CardTitle>
                    <div className="text-sm text-muted-foreground">{(technician.experienceLevel || "mid").toUpperCase()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {technician.type === "thirdparty" && (
                      <Badge variant="secondary" className="bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">Third-Party</Badge>
                    )}
                    <Badge>{technician.status || "available"}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCredentialsConfirmOpen(true)}
                      disabled={resetPasswordMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {resetPasswordMutation.isPending ? 'Sending...' : 'Reset Password'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      disabled={deleteTechnicianMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleteTechnicianMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {technician ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground"/>
                    <span>{technician.phone || technician.whatsappNumber || "Not provided"}</span>
                  </div>

                  {technician.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <i className="fas fa-envelope h-4 w-4 text-muted-foreground"></i>
                      <span>{technician.email}</span>
                    </div>
                  )}

                  {/* Location Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Location:</span>
                    </div>
                    {isEditing ? (
                      <div className="ml-6 relative">
                        <Label htmlFor="location">Base Location</Label>
                        <div className="mt-2">
                        <MapMyIndiaAutocomplete
                          value={editForm.baseLocation}
                          onChange={(value) => {
                            console.log("[Technician Profile] Location changed to:", value);
                            setEditForm({ ...editForm, baseLocation: value });
                          }}
                          placeholder="Search for Indian locations (e.g., Mumbai, Delhi, Bangalore)..."
                          className="w-full"
                        />
                        </div>
                      </div>
                    ) : (
                      <div className="ml-6 text-sm">
                        {typeof technician.baseLocation === "object"
                          ? technician.baseLocation?.city
                          : technician.baseLocation || "Not set"}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Wrench className="h-4 w-4 text-muted-foreground"/>
                    <span>{Array.isArray(technician.skills) ? technician.skills.join(", ") : technician.specialization || "general"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm pt-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500"/>
                    <span>{technician.averageRating ?? 0}/5</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Technician data not available</div>
              )}

              {/* Edit/Save Buttons */}
              {technician && (
                <div className="flex gap-2 pt-4">
                  {isEditing ? (
                    <>
                      <Button
                        onClick={() => {
                          console.log("[Technician Profile] Save clicked, location:", editForm.baseLocation);
                          updateTechnician.mutate({ baseLocation: editForm.baseLocation });
                        }}
                        disabled={updateTechnician.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateTechnician.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button variant="outline" onClick={() => {
                        console.log("[Technician Profile] Cancel clicked");
                        setIsEditing(false);
                      }}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => {
                      console.log("[Technician Profile] Edit clicked");
                      setIsEditing(true);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Location
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Wage / Allowance Section (single, editable) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{isThirdParty ? "Money Allowance" : "Wage Breakdown"}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
                    onClick={() => {
                      if (!wageEditMode) return setWageEditMode(true);
                      return isThirdParty ? updateThirdParty.mutate() : updateWage.mutate();
                    }}
                    disabled={isWageLoading || updateWage.isPending || updateThirdParty.isPending}
                  >
                    {wageEditMode
                      ? ((updateWage.isPending || updateThirdParty.isPending) ? "Saving..." : "💾 Save Changes")
                      : "✏️ Edit"}
                  </Button>
                  {wageEditMode && (
                    <Button variant="outline" onClick={() => setWageEditMode(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isWageLoading && <div className="text-sm text-muted-foreground">Loading wage details…</div>}
              {!isWageLoading && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border">
                  {isThirdParty ? (
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <Label>Total Allowance (₹)</Label>
                        <Input
                          type="number"
                          className="mt-1 input-soft"
                          value={wageForm.moneyAllowance}
                          disabled={!wageEditMode}
                          onChange={(e) => setWageForm({ ...wageForm, moneyAllowance: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label>Grade</Label>
                          <Input
                            className="mt-1 input-soft"
                            value={wageForm.grade}
                            disabled={!wageEditMode}
                            onChange={(e) => setWageForm({ ...wageForm, grade: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Designation</Label>
                          <Input
                            className="mt-1 input-soft"
                            value={wageForm.designation}
                            disabled={!wageEditMode}
                            onChange={(e) => setWageForm({ ...wageForm, designation: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Hotel Allowance (₹)</Label>
                          <Input
                            type="number"
                            className="mt-1 input-soft"
                            value={wageForm.hotelAllowance}
                            disabled={!wageEditMode}
                            onChange={(e) => setWageForm({ ...wageForm, hotelAllowance: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Food Allowance (₹)</Label>
                          <Input
                            type="number"
                            className="mt-1 input-soft"
                            value={wageForm.foodAllowance}
                            disabled={!wageEditMode}
                            onChange={(e) => setWageForm({ ...wageForm, foodAllowance: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Local Travel Allowance (₹)</Label>
                          <Input
                            type="number"
                            className="mt-1 input-soft"
                            value={wageForm.localTravelAllowance}
                            disabled={!wageEditMode}
                            onChange={(e) => setWageForm({ ...wageForm, localTravelAllowance: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Personal Allowance (₹)</Label>
                          <Input
                            type="number"
                            className="mt-1 input-soft"
                            value={wageForm.personalAllowance}
                            disabled={!wageEditMode}
                            onChange={(e) => setWageForm({ ...wageForm, personalAllowance: e.target.value })}
                          />
                        </div>
                      </div>
                      <hr className="my-3 border-border" />
                      <div className="font-semibold text-foreground">
                        Total Daily Wage: ₹
                        {(Number(wageForm.hotelAllowance) || 0) +
                          (Number(wageForm.foodAllowance) || 0) +
                          (Number(wageForm.localTravelAllowance) || 0) +
                          (Number(wageForm.personalAllowance) || 0)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total services</span><span>{performance?.totalServices ?? 0}</span></div>
                <div className="flex justify-between"><span>Average rating</span><span>{performance?.averageRating ?? 0}/5</span></div>
                <div className="flex justify-between"><span>First-time fix</span><span>{performance?.firstTimeFixRate ?? 0}%</span></div>
                <div className="flex justify-between"><span>Recent (30d)</span><span>{performance?.recentServices ?? 0}</span></div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {isScheduleLoading ? (
                  <div className="text-sm text-muted-foreground">Loading schedule…</div>
                ) : (() => {
                  // Use schedule data if available (already filtered by today's date), otherwise fall back to requests
                  let todaySchedule: any[] = [];
                  
                  if (Array.isArray(schedule) && schedule.length > 0) {
                    // Use schedule endpoint data (already filtered by date)
                    todaySchedule = schedule;
                    console.log(`[Technician Profile] Using schedule endpoint data for today:`, todaySchedule.length);
                  } else {
                    // Fallback: filter requests by today's date
                    const source = (technician as any)?.type === 'thirdparty' 
                      ? tpRequests 
                      : (requestsData?.active || requestsData?.all || []);
                    const allAssigned = Array.isArray(source) && source.length > 0
                      ? source.filter((r: any) => {
                          // Note: "assigned" is not a valid status - assignments use "scheduled" status
                          const activeStatuses = ['pending', 'scheduled', 'approved', 'in_progress'];
                          const status = (r.status || '').toLowerCase();
                          return status && activeStatuses.includes(status) && !['completed', 'cancelled'].includes(status) && (r.assignedTechnicianId || (technician as any)?.type === 'thirdparty');
                        })
                      : [];
                    
                    // Filter to only show services scheduled for TODAY
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);
                    
                    todaySchedule = allAssigned.filter((s: any) => {
                      if (!s.scheduledDate) return false;
                      const scheduledDate = new Date(s.scheduledDate);
                      return scheduledDate >= todayStart && scheduledDate <= todayEnd;
                    });
                    console.log(`[Technician Profile] Using filtered requests for today:`, todaySchedule.length);
                  }
                  
                  console.log(`[Technician Profile] Today's schedule for tech ${technicianId}:`, {
                    fromSchedule: Array.isArray(schedule) && schedule.length > 0,
                    total: todaySchedule.length,
                    services: todaySchedule.map((s: any) => ({
                      id: s.id,
                      requestNumber: s.requestNumber || s.id,
                      scheduledDate: s.scheduledDate
                    }))
                  });
                  
                  return todaySchedule.length > 0 ? (
                    <div className="space-y-3">
                      {todaySchedule.map((s: any) => (
                        <Link key={s.id} href={`/service-requests/${s.id}`}>
                          <div className="rounded-md border p-3 hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                            <div className="flex items-center justify-between text-sm">
                              <div className="font-medium">{s.issueDescription || "Service"}</div>
                              <div className="text-muted-foreground">{s.scheduledTimeWindow || "ASAP"}</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              SR #{s.requestNumber} • {formatDate(s.scheduledDate)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Priority: {s.priority} | Container: {s.container?.containerCode || s.containerId}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No scheduled services today.</div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Assigned Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assigned Services</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
                    refetchRequests();
                  }}
                  disabled={isRequestsLoading}
                >
                  🔄 Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(isRequestsLoading || isTpRequestsLoading) ? (
                <div className="text-sm text-muted-foreground">Loading services…</div>
              ) : requestsError ? (
                <div className="text-sm text-destructive">
                  Error loading services: {String(requestsError)}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
                      refetchRequests();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (() => {
                // Use categorized data from backend
                // For third-party, use tpRequests (legacy format), otherwise use new categorized format
                let assigned: any[] = [];
                
                if ((technician as any)?.type === 'thirdparty') {
                  // Third-party: use legacy format
                  assigned = Array.isArray(tpRequests) ? tpRequests : [];
                } else {
                  // Internal: use new categorized format
                  assigned = requestsData?.active || requestsData?.all || requestsData?.assigned || [];
                }
                
                console.log(`[Technician Profile] Displaying assigned services for tech ${technicianId}:`, {
                  sourceType: (technician as any)?.type,
                  isArray: Array.isArray(assigned),
                  length: assigned.length,
                  services: assigned.map((r: any) => ({
                    id: r.id,
                    requestNumber: r.requestNumber,
                    status: r.status,
                    assignedTechnicianId: r.assignedTechnicianId,
                    containerCode: r.container?.containerCode
                  }))
                });
                
                // Debug info
                if (assigned.length === 0) {
                  console.warn(`[Technician Profile] No assigned services displayed for tech ${technicianId}. Raw data:`, {
                    requestsData: requestsData,
                    tpRequests: tpRequests,
                    assigned: assigned,
                    technicianType: (technician as any)?.type,
                    technicianId: technicianId
                  });
                }
                
                return assigned.length > 0 ? (
                  <div className="space-y-3">
                    {assigned.map((r: any) => {
                      // Check if this is a PM Travel task
                      const isPMTravel = r.excelData?.techBookingSource === 'auto_pm_travel' || 
                                        r.excelData?.purpose === 'PM' ||
                                        (r.issueDescription?.toLowerCase().includes('preventive maintenance') && r.excelData?.travelTripId);
                      const bookingStatus = r.excelData?.bookingStatus;
                      const isReadOnly = isPMTravel; // PM Travel tasks are read-only
                      
                      return (
                        <div key={r.id} className={`rounded-md border p-3 ${isReadOnly ? 'bg-muted/30' : 'hover:bg-accent hover:border-primary transition-colors'} ${isReadOnly ? '' : 'cursor-pointer'}`}>
                          {!isReadOnly ? (
                            <Link href={`/service-requests/${r.id}`}>
                              <div>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="font-medium text-primary hover:underline">SR #{r.requestNumber}</div>
                                  <div className="flex items-center gap-2">
                                    {isPMTravel && (
                                      <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-400/30">
                                        PM
                                      </Badge>
                                    )}
                                    {bookingStatus === 'confirmed' && (
                                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-400/30">
                                        Confirmed
                                      </Badge>
                                    )}
                                    <Badge className={
                                      r.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                      r.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                      r.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                      r.status === 'approved' ? 'bg-green-100 text-green-800' :
                                      r.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                      r.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>
                                      {r.status}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-sm mt-1">{r.issueDescription || "Service"}</div>
                                {r.status === 'in_progress' && r.actualStartTime && (
                                  <div className="mt-2">
                                    <ElapsedTime startTime={r.actualStartTime} />
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                  {r.scheduledDate && `Scheduled: ${formatDate(r.scheduledDate)}`}
                                  {r.scheduledTimeWindow && ` (${r.scheduledTimeWindow})`}
                                  {!r.scheduledDate && <span className="text-orange-600">Not yet scheduled</span>}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Priority: {r.priority} | Container: {r.container?.containerCode || r.containerId}
                                </div>
                              </div>
                            </Link>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="font-medium">SR #{r.requestNumber}</div>
                                <div className="flex items-center gap-2">
                                  {isPMTravel && (
                                    <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-400/30">
                                      PM
                                    </Badge>
                                  )}
                                  {bookingStatus === 'confirmed' && (
                                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-400/30">
                                      Confirmed
                                    </Badge>
                                  )}
                                  <Badge className={
                                    r.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                    r.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                    r.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                    r.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    r.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                    r.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {r.status}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-sm mt-1">{r.issueDescription || "Service"}</div>
                              {r.status === 'in_progress' && r.actualStartTime && (
                                <div className="mt-2">
                                  <ElapsedTime startTime={r.actualStartTime} />
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {r.scheduledDate && `Scheduled: ${formatDate(r.scheduledDate)}`}
                                {r.scheduledTimeWindow && ` (${r.scheduledTimeWindow})`}
                                {!r.scheduledDate && <span className="text-orange-600">Not yet scheduled</span>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Priority: {r.priority} | Container: {r.container?.containerCode || r.containerId}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                PM Travel Task - Read Only
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">No assigned services.</div>
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      <strong>Debug Info:</strong> Technician ID: {technicianId} | 
                      API returned: {requestsData?.active?.length || requestsData?.all?.length || 0} active services ({requestsData?.all?.length || 0} total) | 
                      Check browser console for details
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Completed Services / Service History */}
          <Card>
            <CardHeader>
              <CardTitle>Service History</CardTitle>
            </CardHeader>
            <CardContent>
              {isHistoryLoading ? (
                <div className="text-sm text-muted-foreground">Loading service history…</div>
              ) : historyError ? (
                <div className="text-sm text-destructive">
                  Error loading history: {String(historyError)}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "service-history"] });
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (() => {
                // Use the dedicated service history data
                const completed = Array.isArray(serviceHistory) ? serviceHistory : [];
                
                console.log(`[Technician Profile] Service history for tech ${technicianId}:`, {
                  total: completed.length,
                  services: completed.map((r: any) => ({
                    id: r.id,
                    requestNumber: r.requestNumber,
                    status: r.status,
                    containerCode: r.container?.containerCode
                  }))
                });
                
                return completed.length > 0 ? (
                  <div className="space-y-3">
                    {completed.map((r: any) => (
                      <Link key={r.id} href={`/service-requests/${r.id}`}>
                        <div className="rounded-md border p-3 hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium text-primary hover:underline">
                              {r.jobOrder ? `Job Order: ${r.jobOrder}` : `SR #${r.requestNumber}`}
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              {r.callStatus || r.status}
                            </Badge>
                          </div>
                          <div className="text-sm mt-1">{r.issueDescription || "Service"}</div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                            {r.workType && (
                              <div><span className="font-medium">Work Type:</span> {r.workType}</div>
                            )}
                            {r.clientType && (
                              <div><span className="font-medium">Client Type:</span> {r.clientType}</div>
                            )}
                            {r.jobType && (
                              <div><span className="font-medium">Job Type:</span> {r.jobType}</div>
                            )}
                            {r.billingType && (
                              <div><span className="font-medium">Billing:</span> {r.billingType}</div>
                            )}
                            {(r.month || r.year) && (
                              <div><span className="font-medium">Period:</span> {r.month} {r.year}</div>
                            )}
                            {r.durationMinutes && (
                              <div className="text-green-700">
                                <span className="font-medium">Duration:</span> {Math.floor(r.durationMinutes / 60)}h {r.durationMinutes % 60}m
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Completed:</span> {r.completed_at ? formatDate(r.completed_at) : (r.actualEndTime ? formatDate(r.actualEndTime) : "-")}
                            </div>
                            {r.container?.containerCode && (
                              <div><span className="font-medium">Container:</span> {r.container.containerCode}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No service history available.</div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Send Credentials Confirmation Dialog */}
      <Dialog open={isCredentialsConfirmOpen} onOpenChange={setIsCredentialsConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <i className="fas fa-exclamation-triangle"></i>
              Reset Password Warning
            </DialogTitle>
            <DialogDescription className="text-left">
              <div className="space-y-3">
                <p className="font-medium">
                  You are about to reset the password for <strong>{technician?.name}</strong>.
                </p>
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-shield-alt text-warning mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-warning-foreground mb-1">
                        ⚠️ This action will:
                      </p>
                      <ul className="text-xs text-warning-foreground space-y-1 ml-4">
                        <li>• Generate a secure one-time password reset link</li>
                        <li>• Send the link via email to the technician</li>
                        <li>• Link expires in 1 hour</li>
                        <li>• Technician sets their own secure password</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>🔒 Security:</strong> The technician's email ({technician?.email || 'email address'}) will be used as their login ID. They'll choose their own strong password via the secure link.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsCredentialsConfirmOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmResetPassword}
              disabled={resetPasswordMutation.isPending}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Sending...
                </>
              ) : (
                <>
                  <i className="fas fa-key mr-2"></i>
                  Send Reset Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Technician
            </DialogTitle>
            <DialogDescription className="text-left">
              <div className="space-y-3">
                <p className="font-medium">
                  Are you sure you want to delete <strong>{technician?.name}</strong>?
                </p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-exclamation-triangle text-destructive mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-destructive-foreground mb-1">
                        ⚠️ This action will:
                      </p>
                      <ul className="text-xs text-destructive-foreground space-y-1 ml-4">
                        <li>• Mark the user account as inactive</li>
                        <li>• Remove the technician record permanently</li>
                        <li>• This action cannot be undone</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: You cannot delete a technician with active service requests.
                  Please reassign or complete them first.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteTechnicianMutation.isPending}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteTechnicianMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Technician
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}