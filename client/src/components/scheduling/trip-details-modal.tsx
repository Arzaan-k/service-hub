import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  MapPin,
  Phone,
  Star,
  Calendar,
  IndianRupee,
  Wrench,
  Package,
  FileText,
  Building2,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface TripDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
}

interface TripData {
  id: string;
  technicianId: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  tripStatus: string;
  totalTasks: number;
  totalCost: number;
  tasks: any[];
  technician?: any;
  serviceRequests?: any[];
  pmContainers?: any[];
  costs?: any;
}

interface TechnicianData {
  id: string;
  name: string;
  employeeCode: string;
  phone: string;
  email: string;
  baseLocation: string;
  grade: string;
  specialization: string[];
  rating?: number;
  currentLocation?: string;
}

export function TripDetailsModal({
  isOpen,
  onClose,
  tripId
}: TripDetailsModalProps) {
  const [miscellaneousCost, setMiscellaneousCost] = useState<number>(0);
  const { toast } = useToast();

  // Fetch trip details
  const { data: tripData, isLoading: tripLoading } = useQuery({
    queryKey: ["/api/scheduling/travel/trips", tripId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduling/travel/trips/${tripId}`);
      return await res.json();
    },
    enabled: isOpen && !!tripId,
  });

  // Fetch technician details
  const { data: technicianData, isLoading: technicianLoading } = useQuery({
    queryKey: ["/api/technicians", tripData?.technicianId],
    queryFn: async () => {
      if (!tripData?.technicianId) return null;
      const res = await apiRequest("GET", `/api/technicians/${tripData.technicianId}`);
      return await res.json();
    },
    enabled: isOpen && !!tripData?.technicianId,
  });

  // Fetch technician wage information
  const { data: wageData } = useQuery({
    queryKey: ["/api/technicians", tripData?.technicianId, "wage"],
    queryFn: async () => {
      if (!tripData?.technicianId) return null;
      const res = await apiRequest("GET", `/api/technicians/${tripData.technicianId}/wage`);
      return await res.json();
    },
    enabled: isOpen && !!tripData?.technicianId,
  });

  const technician = technicianData as TechnicianData;
  const trip = tripData as TripData;

  // Group tasks by type
  const serviceRequests = trip?.tasks?.filter((task: any) => task.taskType === 'service' || task.taskType === 'alert') || [];
  const pmTasks = trip?.tasks?.filter((task: any) => task.taskType === 'pm') || [];

  // Group services by city
  const servicesByCity = serviceRequests.reduce((acc: any, task: any) => {
    const city = task.container?.currentLocation?.city || task.customer?.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = {
        city,
        services: [],
        totalCost: 0,
        clientCount: new Set()
      };
    }
    acc[city].services.push(task);
    acc[city].totalCost += task.estimatedCost || 0;
    if (task.customer?.companyName) {
      acc[city].clientCount.add(task.customer.companyName);
    }
    return acc;
  }, {});

  // Group PM tasks by city
  const pmTasksByCity = pmTasks.reduce((acc: any, task: any) => {
    const city = task.container?.currentLocation?.city || task.customer?.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = {
        city,
        tasks: [],
        totalCost: 0,
        clientCount: new Set()
      };
    }
    acc[city].tasks.push(task);
    acc[city].totalCost += task.estimatedCost || 1800; // Default PM cost
    if (task.customer?.companyName) {
      acc[city].clientCount.add(task.customer.companyName);
    }
    return acc;
  }, {});

  const handleGenerateTripPDF = async () => {
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your PDF...",
      });

      const res = await apiRequest("POST", `/api/scheduling/travel/trips/${tripId}/pdf`, {
        tripData: trip,
        technician: technician,
        serviceRequests: serviceRequests,
        pmContainers: pmTasks,
        miscellaneousCost: miscellaneousCost
      });

      if (res.ok) {
        // Create blob from response and trigger download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Trip-Details-${technician?.name || 'Technician'}-${trip?.destinationCity || 'Destination'}-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "PDF Generated Successfully",
          description: "Trip details PDF has been downloaded.",
        });
      } else {
        throw new Error("Failed to generate PDF");
      }
    } catch (error: any) {
      toast({
        title: "Failed to Generate PDF",
        description: error?.message || "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'planned': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal':
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (tripLoading || technicianLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Trip Details: {trip?.destinationCity}
          </DialogTitle>
          <DialogDescription>
            Complete trip information and cost breakdown
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Technician Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Technician Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {technician ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{technician.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">TECH ID</p>
                    <p className="font-mono font-medium">{technician.employeeCode}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Current Location</p>
                    <p className="font-medium">{technician.currentLocation || technician.baseLocation || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Category</p>
                    <Badge variant="outline">{technician.grade || 'N/A'}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-mono font-medium">{technician.phone || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{technician.rating || '4.5'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Technician information not available</p>
              )}
            </CardContent>
          </Card>

          {/* Assigned Services (Grouped by City) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Assigned Services ({serviceRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(servicesByCity).length > 0 ? (
                <div className="space-y-4">
                  {Object.values(servicesByCity).map((cityGroup: any) => (
                    <div key={cityGroup.city} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{cityGroup.city}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {cityGroup.clientCount.size} clients
                          </span>
                          <span className="text-muted-foreground">
                            {cityGroup.services.length} services
                          </span>
                          <div className="flex items-center gap-1 font-medium">
                            <IndianRupee className="h-3 w-3" />
                            {cityGroup.totalCost.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {cityGroup.services.slice(0, 3).map((task: any) => (
                          <div key={task.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div className="flex items-center gap-3">
                              <Badge className={getPriorityColor(task.priority || 'normal')}>
                                {task.priority || 'Normal'}
                              </Badge>
                              <span className="text-sm font-medium">
                                {task.container?.containerCode || task.serviceRequest?.requestNumber || 'N/A'}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {task.customer?.companyName || 'Unknown Client'} • {task.container?.currentLocation?.address || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(task.status || 'pending')}>
                                {task.status || 'Pending'}
                              </Badge>
                              <span className="text-sm font-medium">
                                ₹{task.estimatedCost?.toLocaleString() || '0'}
                              </span>
                            </div>
                          </div>
                        ))}
                        {cityGroup.services.length > 3 && (
                          <p className="text-sm text-muted-foreground text-center">
                            +{cityGroup.services.length - 3} more services
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No assigned services</p>
              )}
            </CardContent>
          </Card>

          {/* PM Tasks included in the trip */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                PM Tasks ({pmTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(pmTasksByCity).length > 0 ? (
                <div className="space-y-4">
                  {Object.values(pmTasksByCity).map((cityGroup: any) => (
                    <div key={cityGroup.city} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{cityGroup.city}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {cityGroup.clientCount.size} clients
                          </span>
                          <span className="text-muted-foreground">
                            {cityGroup.tasks.length} PM tasks
                          </span>
                          <div className="flex items-center gap-1 font-medium">
                            <IndianRupee className="h-3 w-3" />
                            {cityGroup.totalCost.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {cityGroup.tasks.slice(0, 3).map((task: any) => (
                          <div key={task.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div className="flex items-center gap-3">
                              <Badge className={getPriorityColor(task.priority || 'normal')}>
                                {task.priority || 'Normal'}
                              </Badge>
                              <span className="text-sm font-medium">
                                {task.container?.containerCode || 'N/A'}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {task.customer?.companyName || 'Unknown Client'} • {task.container?.currentLocation?.address || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(task.status || 'pending')}>
                                {task.status || 'Pending'}
                              </Badge>
                              <span className="text-sm font-medium">
                                ₹{task.estimatedCost?.toLocaleString() || '1,800'}
                              </span>
                            </div>
                          </div>
                        ))}
                        {cityGroup.tasks.length > 3 && (
                          <p className="text-sm text-muted-foreground text-center">
                            +{cityGroup.tasks.length - 3} more PM tasks
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No PM tasks assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Trip Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Start:</span>
                  <span>{new Date(trip?.startDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">End:</span>
                  <span>{new Date(trip?.endDate).toLocaleDateString()}</span>
                </div>
                <Badge variant="outline" className="ml-4">
                  {Math.ceil((new Date(trip?.endDate).getTime() - new Date(trip?.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wageData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Service Request Cost</Label>
                        <p className="text-lg font-medium">
                          ₹{wageData.taskBreakdown?.serviceRequests?.total?.toLocaleString('en-IN') ||
                            serviceRequests.reduce((sum, task) => sum + (task.estimatedCost || 0), 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {serviceRequests.length} × ₹{wageData.taskBreakdown?.serviceRequests?.rate || 0}
                        </p>
                      </div>
                      <div>
                        <Label>PM Task Cost</Label>
                        <p className="text-lg font-medium">
                          ₹{wageData.taskBreakdown?.pmTasks?.total?.toLocaleString('en-IN') ||
                            pmTasks.reduce((sum, task) => sum + (task.estimatedCost || 1800), 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pmTasks.length} × ₹{wageData.taskBreakdown?.pmTasks?.rate || 1800}
                        </p>
                      </div>
                      <div>
                        <Label>Travel Allowance</Label>
                        <p className="text-lg font-medium">
                          ₹{wageData.allowances?.dailyAllowance?.total?.toLocaleString('en-IN') || '0'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ₹{wageData.allowances?.dailyAllowance?.rate || 0} × {wageData.allowances?.dailyAllowance?.days || 0} days
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="miscellaneous">Miscellaneous</Label>
                        <Input
                          id="miscellaneous"
                          type="number"
                          value={miscellaneousCost}
                          onChange={(e) => setMiscellaneousCost(Number(e.target.value))}
                          placeholder="Enter miscellaneous cost"
                        />
                        {wageData.additionalCosts?.miscellaneous && (
                          <p className="text-xs text-muted-foreground">
                            {wageData.additionalCosts.miscellaneous.percentage}% of task costs
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Subtotal (Tasks)</span>
                        <span>₹{wageData.summary?.subtotal?.toLocaleString('en-IN') || '0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Travel Allowance</span>
                        <span>₹{wageData.summary?.totalAllowance?.toLocaleString('en-IN') || '0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Additional Costs</span>
                        <span>₹{wageData.summary?.totalAdditional?.toLocaleString('en-IN') || '0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Miscellaneous</span>
                        <span>₹{miscellaneousCost.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Total Estimated Cost</span>
                      <span className="text-xl font-bold">
                        ₹{(wageData.summary?.totalCost + miscellaneousCost).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Loading cost breakdown...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generate PDF Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleGenerateTripPDF} className="gap-2">
              <FileText className="h-4 w-4" />
              Generate PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
