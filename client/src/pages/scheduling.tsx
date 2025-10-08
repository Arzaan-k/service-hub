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

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["/api/scheduling/daily", selectedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduling/daily/${selectedDate}`);
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
      return await apiRequest("POST", "/api/scheduling/run");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Optimization Complete",
        description: `Scheduled ${data?.assignedCount || 0} services for tomorrow`,
      });
    },
    onError: () => {
      toast({
        title: "Optimization Failed",
        description: "Failed to run scheduling optimization",
        variant: "destructive",
      });
    },
  });

  const handleRunOptimization = () => {
    if (confirm("Run AI-powered scheduling optimization for tomorrow?")) {
      runOptimization.mutate();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      scheduled: "bg-blue-100 text-blue-800 border-blue-200",
      in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
    };
    return statusMap[status] || statusMap.scheduled;
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

  // Group schedule by technician
  const scheduleByTechnician = schedule?.reduce((acc: any, item: ScheduledService) => {
    const techId = item.technician.id;
    if (!acc[techId]) {
      acc[techId] = {
        technician: item.technician,
        services: [],
      };
    }
    acc[techId].services.push(item);
    return acc;
  }, {});

  const technicianSchedules = scheduleByTechnician
    ? Object.values(scheduleByTechnician)
    : [];

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
                <Button
                  onClick={handleRunOptimization}
                  disabled={runOptimization.isPending}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {runOptimization.isPending ? "Optimizing..." : "Run AI Optimization"}
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {schedule?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Scheduled Services</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {technicianSchedules.length}
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
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
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
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-purple-600" />
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
                  {canSchedule ? "Run the AI optimization to generate a schedule" : "Schedule will appear here when generated"}
                </p>
                {canSchedule && (
                  <Button onClick={handleRunOptimization} disabled={runOptimization.isPending}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Schedule
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
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 border">
                        {techSchedule.services.reduce(
                          (total: number, s: ScheduledService) =>
                            total + s.estimatedServiceDuration + s.estimatedTravelTime,
                          0
                        )}{" "}
                        min
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {techSchedule.services
                        .sort((a: ScheduledService, b: ScheduledService) => a.sequenceNumber - b.sequenceNumber)
                        .map((service: ScheduledService, index: number) => (
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
                                    {service.container.containerCode}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    SR #{service.serviceRequest.requestNumber}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Badge className={`${getPriorityBadge(service.serviceRequest.priority)} border text-xs`}>
                                    {service.serviceRequest.priority}
                                  </Badge>
                                  <Badge className={`${getStatusBadge(service.status)} border text-xs`}>
                                    {service.status}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-foreground">
                                {service.serviceRequest.issueDescription}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {service.estimatedStartTime} - {service.estimatedEndTime}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {service.estimatedServiceDuration} min
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Travel: {service.estimatedTravelTime} min
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
