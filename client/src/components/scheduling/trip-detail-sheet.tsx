import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  MapPin,
  User,
  DollarSign,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

interface TripDetailSheetProps {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function TripDetailSheet({ tripId, open, onOpenChange, onUpdate }: TripDetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const user = getCurrentUser();
  const canEdit = ["admin", "coordinator", "super_admin"].includes((user?.role || "").toLowerCase());

  const { data: trip, isLoading } = useQuery({
    queryKey: ["/api/scheduling/travel/trips", tripId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduling/travel/trips/${tripId}`);
      return await res.json();
    },
    enabled: open && !!tripId,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      await apiRequest("PATCH", `/api/scheduling/travel/trips/${tripId}/tasks/${taskId}`, {
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips", tripId] });
      onUpdate();
      toast({
        title: "Task Updated",
        description: "Task status has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Task",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const sendPlan = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/scheduling/travel/trips/${tripId}/send-plan`);
      return await res.json();
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries to refresh technician views
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] });
      
      // Invalidate technician-specific queries if we have the technician ID
      if (trip?.technicianId) {
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", trip.technicianId] });
        queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
      }
      
      onUpdate();
      toast({
        title: "Travel Plan Sent",
        description: `The travel plan was sent to the technician via WhatsApp. ${data?.pmCount || 0} PM tasks assigned.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Plan",
        description: error.message || "An error occurred while sending the travel plan.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      completed: { className: "bg-green-500/20 text-green-400 border-green-400/30", label: "Completed" },
      in_progress: { className: "bg-blue-500/20 text-blue-400 border-blue-400/30", label: "In Progress" },
      pending: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-400/30", label: "Pending" },
      cancelled: { className: "bg-red-500/20 text-red-400 border-red-400/30", label: "Cancelled" },
    };
    const config = statusMap[status] || statusMap.pending;
    return <Badge className={`${config.className} border`}>{config.label}</Badge>;
  };

  const getTaskTypeBadge = (type: string) => {
    const typeMap: Record<string, { className: string; icon: any }> = {
      pm: { className: "bg-blue-500/20 text-blue-400", icon: Package },
      alert: { className: "bg-red-500/20 text-red-400", icon: AlertCircle },
      inspection: { className: "bg-purple-500/20 text-purple-400", icon: CheckCircle },
    };
    const config = typeMap[type] || typeMap.pm;
    const Icon = config.icon;
    return (
      <Badge className={`${config.className} border gap-1`}>
        <Icon className="h-3 w-3" />
        {type.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Trip Details</SheetTitle>
          <SheetDescription>
            View trip information, costs, and assigned tasks
          </SheetDescription>
        </SheetHeader>

        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => sendPlan.mutate()}
              disabled={sendPlan.isPending}
              className="gap-2"
            >
              {sendPlan.isPending ? "Sending..." : "Send Travel Plan"}
            </Button>
          </div>
        )}

        <div className="space-y-6 mt-6">
          {/* Trip Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trip Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Technician</p>
                    <p className="font-medium">{trip.technician?.name || trip.technician?.user?.name || trip.technicianId || 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="font-medium">{trip.destinationCity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Origin</p>
                    <p className="font-medium">{trip.origin}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dates</p>
                    <p className="font-medium">
                      {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Trip Status</p>
                  <Badge 
                    className={
                      trip.tripStatus === 'completed' ? 'bg-green-500/20 text-green-400 border-green-400/30' :
                      trip.tripStatus === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-400/30' :
                      trip.tripStatus === 'booked' ? 'bg-purple-500/20 text-purple-400 border-purple-400/30' :
                      trip.tripStatus === 'cancelled' ? 'bg-red-500/20 text-red-400 border-red-400/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-400/30'
                    }
                  >
                    {trip.tripStatus || 'planned'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Booking Status</p>
                  <Badge variant="outline">
                    {trip.bookingStatus === 'all_confirmed' ? '✓ All Confirmed' :
                     trip.bookingStatus === 'hotel_booked' ? '🏨 Hotel Booked' :
                     trip.bookingStatus === 'tickets_booked' ? '🎫 Tickets Booked' :
                     'Not Started'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <Badge variant="outline">{trip.purpose?.toUpperCase() || 'PM'}</Badge>
                </div>
              </div>
              {trip.notes && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{trip.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          {trip.costs && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Travel Fare:</span>
                    <span className="font-medium">₹{parseFloat(trip.costs.travelFare || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Stay Cost:</span>
                    <span className="font-medium">₹{parseFloat(trip.costs.stayCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Daily Allowance:</span>
                    <span className="font-medium">₹{parseFloat(trip.costs.dailyAllowance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Local Travel:</span>
                    <span className="font-medium">₹{parseFloat(trip.costs.localTravelCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Miscellaneous:</span>
                    <span className="font-medium">₹{parseFloat(trip.costs.miscCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between">
                    <span className="font-semibold">Total Estimated Cost:</span>
                    <span className="text-xl font-bold text-primary">
                      ₹{parseFloat(trip.costs.totalEstimatedCost || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assigned Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Assigned Tasks ({trip.tasks?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!trip.tasks || trip.tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks assigned yet</p>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={async () => {
                        try {
                          await apiRequest("POST", `/api/scheduling/travel/trips/${tripId}/auto-assign-tasks`);
                          queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips", tripId] });
                          toast({
                            title: "Tasks Auto-Assigned",
                            description: "PM tasks have been automatically assigned to this trip",
                          });
                          onUpdate();
                        } catch (error: any) {
                          toast({
                            title: "Failed to Assign Tasks",
                            description: error.message || "An error occurred",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Auto-Assign Tasks
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Container</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trip.tasks.map((task: any) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {task.container?.id ? (
                              <Button
                                variant="link"
                                className="h-auto p-0 font-medium"
                                onClick={() => {
                                  setLocation(`/containers/${task.container.id}`);
                                  onOpenChange(false);
                                }}
                              >
                                {task.container.containerCode || task.containerId}
                              </Button>
                            ) : (
                              <span className="font-medium">{task.containerId || 'Unknown'}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.siteName || task.customer?.companyName || 'Unknown Site'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTaskTypeBadge(task.taskType)}
                            {task.alertId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => {
                                  setLocation(`/alerts`);
                                  onOpenChange(false);
                                }}
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Alert
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.scheduledDate ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.scheduledDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(task.status)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Select
                              value={task.status}
                              onValueChange={(value) => {
                                updateTaskStatus.mutate({ taskId: task.id, status: value });
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

