import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

export default function Scheduling() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = getCurrentUser();
  const role = (user?.role || "client").toLowerCase();
  const canSchedule = ["admin", "coordinator", "super_admin"].includes(role);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

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

  const runOptimization = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scheduling/run");
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      
      const assignedCount = data?.assignments?.filter((a: any) => a.assigned).length || 0;
      const totalCount = data?.totalRequests || 0;
      
      if (assignedCount > 0) {
        // Show detailed assignment results
        const assignmentDetails = data.assignments
          .filter((a: any) => a.assigned)
          .map((a: any) => `SR #${a.request?.requestNumber} → ${technicians?.find((t: any) => t.id === a.technicianId)?.name || 'Unknown'}`)
          .join('\n');
        
        toast({
          title: "✅ Auto-Assignment Complete",
          description: `Successfully assigned ${assignedCount}/${totalCount} requests:\n${assignmentDetails}`,
        });
      } else {
        toast({
          title: "⚠️ No Assignments Made",
          description: totalCount > 0 ? "No available technicians found for pending requests" : "No pending requests to assign",
          variant: "destructive",
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
    if (confirm("Run auto-assignment for all pending service requests?")) {
      runOptimization.mutate();
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Scheduling" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                className="px-3 py-2 border border-border rounded-lg text-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
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

            <Card>
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
              <Card>
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
              <Card>
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
                <Card key={techSchedule.technician.id}>
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
                            className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
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
        </div>
      </main>
    </div>
  );
}
