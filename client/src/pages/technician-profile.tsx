import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { MapPin, Phone, Star, Wrench, ArrowLeft, Edit, Save, X, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MapMyIndiaAutocomplete from "@/components/map-my-india-autocomplete";

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

  const sendCredentialsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/users/${technicianId}/send-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send credentials');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "New credentials sent via email",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send credentials",
        variant: "destructive",
      });
    },
  });

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
            <Link href="/technicians"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button></Link>
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
            <Link href="/technicians"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button></Link>
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
                    <Badge className="bg-pink-200 text-pink-800">Third-Party</Badge>
                  )}
                  <Badge>{technician.status || "available"}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendCredentialsMutation.mutate()}
                    disabled={sendCredentialsMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendCredentialsMutation.isPending ? 'Sending...' : 'Send Credentials'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground"/>
                <span>{technician.phone || technician.whatsappNumber}</span>
              </div>

              {/* Location Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground"/>
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
                <Wrench className="h-4 w-4 text-muted-foreground"/>
                <span>{Array.isArray(technician.skills) ? technician.skills.join(", ") : technician.specialization || "general"}</span>
              </div>
              <div className="flex items-center gap-1 text-sm pt-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500"/>
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
                    className="bg-orange-200 hover:bg-orange-300 text-black"
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
                <div className="p-4 rounded-xl" style={{ background: '#FFF9F7', border: '1px solid #FFE0D6' }}>
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
                      <hr className="my-3 border-[#FFE0D6]" />
                      <div className="font-semibold text-black">
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
    </div>
  );
}




