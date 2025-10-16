import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { MapPin, Phone, Star, Wrench, ArrowLeft } from "lucide-react";

function formatDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString();
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
    enabled: !!technicianId,
  });

  const { data: performance } = useQuery({
    queryKey: ["/api/technicians", technicianId, "performance"],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/performance`)).json(),
    enabled: !!technicianId,
  });

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
                <Badge>{technician.status || "available"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground"/><span>{technician.phone || technician.whatsappNumber}</span></div>
              <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground"/><span>{typeof technician.baseLocation === "object" ? technician.baseLocation?.city : technician.baseLocation || "Not set"}</span></div>
              <div className="flex items-center gap-2 text-sm"><Wrench className="h-4 w-4 text-muted-foreground"/><span>{Array.isArray(technician.skills) ? technician.skills.join(", ") : technician.specialization || "general"}</span></div>
              <div className="flex items-center gap-1 text-sm pt-1"><Star className="h-4 w-4 text-yellow-500 fill-yellow-500"/><span>{technician.averageRating ?? 0}/5</span></div>
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
                <CardTitle>Today’s Schedule</CardTitle>
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
              {isRequestsLoading ? (
                <div className="text-sm text-muted-foreground">Loading services…</div>
              ) : (() => {
                const assigned = Array.isArray(requests) 
                  ? requests.filter((r: any) => ['scheduled', 'in_progress', 'pending'].includes(r.status))
                  : [];
                
                return assigned.length > 0 ? (
                  <div className="space-y-3">
                    {assigned.map((r: any) => (
                      <div key={r.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-medium">SR #{r.requestNumber}</div>
                          <Badge className={
                            r.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            r.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {r.status}
                          </Badge>
                        </div>
                        <div className="text-sm mt-1">{r.issueDescription || "Service"}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.scheduledDate && `Scheduled: ${formatDate(r.scheduledDate)}`}
                          {r.scheduledTimeWindow && ` (${r.scheduledTimeWindow})`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Priority: {r.priority} | Container: {r.container?.containerCode || r.containerId}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No assigned services.</div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Completed Services */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Services</CardTitle>
            </CardHeader>
            <CardContent>
              {isRequestsLoading ? (
                <div className="text-sm text-muted-foreground">Loading services…</div>
              ) : completed.length > 0 ? (
                <div className="space-y-3">
                  {completed.map((r: any) => (
                    <div key={r.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium">SR #{r.requestNumber}</div>
                        <div className="text-muted-foreground">{r.scheduledTimeWindow || ""}</div>
                      </div>
                      <div className="text-sm mt-1">{r.issueDescription || "Service"}</div>
                      <div className="text-xs text-muted-foreground">Completed: {r.completed_at ? formatDate(r.completed_at) : (r.actualEndTime ? formatDate(r.actualEndTime) : "-")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No completed services yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}




