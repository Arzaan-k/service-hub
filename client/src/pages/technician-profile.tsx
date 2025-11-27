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

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const isoDate = `${yyyy}-${mm}-${dd}`;

  const { data: schedule, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["/api/technicians", technicianId, "schedule", isoDate],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/schedule?date=${isoDate}`)).json(),
    enabled: !!technicianId,
  });

  const { data: requests, isLoading: isRequestsLoading } = useQuery({
    queryKey: ["/api/service-requests/technician", technicianId],
    queryFn: async () => (await apiRequest("GET", `/api/service-requests/technician/${technicianId}`)).json(),
    enabled: !!technicianId && !(technician as any)?.type,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue refetching even when tab is not active
  });

  // Third-party assigned services
  const { data: tpRequests, isLoading: isTpRequestsLoading } = useQuery({
    queryKey: ["/api/services-by-technician", technicianId, "thirdparty"],
    queryFn: async () => (await apiRequest("GET", `/api/services-by-technician/${technicianId}?type=thirdparty`)).json(),
    enabled: !!technicianId && (technician as any)?.type === "thirdparty",
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const { data: performance } = useQuery({
    queryKey: ["/api/technicians", technicianId, "performance"],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/performance`)).json(),
    enabled: !!technicianId,
  });

  // Wage details (editable)
  const { data: wageData, isLoading: isWageLoading } = useQuery({
    queryKey: ["/api/technicians", technicianId, "wage"],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/wage`)).json(),
    enabled: !!technicianId,
  });
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

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ baseLocation: "" });
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
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Technician profile updated successfully",
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

  const completed = Array.isArray(requests)
    ? requests.filter((r: any) => r.status === "completed")
    : [];

  if (isTechLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Technician Profile" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  if (techError || !technician) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Technician Profile" />
          <div className="p-6">
            <Link href="/technicians"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <div className="mt-6 text-destructive">Failed to load technician.</div>
          </div>
        </main>
      </div>
    );
  }

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
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{technician.name}</CardTitle>
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{technician.phone || technician.whatsappNumber}</span>
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
                        onChange={(value) => setEditForm({ ...editForm, baseLocation: value })}
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
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span>{Array.isArray(technician.skills) ? technician.skills.join(", ") : technician.specialization || "general"}</span>
              </div>
              <div className="flex items-center gap-1 text-sm pt-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span>{technician.averageRating ?? 0}/5</span>
              </div>

              {/* Edit/Save Buttons */}
              <div className="flex gap-2 pt-4">
                {isEditing ? (
                  <>
                    <Button onClick={() => updateTechnician.mutate({ baseLocation: editForm.baseLocation })} disabled={updateTechnician.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {updateTechnician.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                    }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Location
                  </Button>
                )}
              </div>
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
                ) : Array.isArray(schedule) && schedule.length > 0 ? (
                  <div className="space-y-3">
                    {schedule.map((s: any) => (
                      <div key={s.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-medium">{s.issueDescription || "Service"}</div>
                          <div className="text-muted-foreground">{s.scheduledTimeWindow || ""}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(s.scheduledDate)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No scheduled services today.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Assigned Services */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Services</CardTitle>
            </CardHeader>
            <CardContent>
              {(isRequestsLoading || isTpRequestsLoading) ? (
                <div className="text-sm text-muted-foreground">Loading services…</div>
              ) : (() => {
                const source = (technician as any)?.type === 'thirdparty' ? tpRequests : requests;
                const assigned = Array.isArray(source)
                  ? source.filter((r: any) => ['scheduled', 'in_progress', 'pending', 'assigned'].includes(r.status))
                  : [];

                return assigned.length > 0 ? (
                  <div className="space-y-3">
                    {assigned.map((r: any) => (
                      <Link key={r.id} href={`/service-requests/${r.id}`}>
                        <div className="rounded-md border p-3 hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium text-primary hover:underline">SR #{r.requestNumber}</div>
                            <Badge className={
                              r.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                r.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                            }>
                              {r.status}
                            </Badge>
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
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Priority: {r.priority} | Container: {r.container?.containerCode || r.containerId}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No assigned services.</div>
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
              {isRequestsLoading ? (
                <div className="text-sm text-muted-foreground">Loading service history…</div>
              ) : completed.length > 0 ? (
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
              )}
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




