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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye,
  FileText,
  Building2,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface TechnicianTripDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicianId: string;
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

interface ServiceRequest {
  id: string;
  requestNumber: string;
  priority: string;
  issueDescription: string;
  estimatedDuration: number;
  estimatedCost: number;
  status: string;
  customer: {
    companyName: string;
    city: string;
  };
  container: {
    containerCode: string;
    currentLocation: {
      address: string;
      city: string;
    };
  };
  scheduledDate: string;
}

interface PMTask {
  id: string;
  containerCode: string;
  customerName: string;
  city: string;
  lastPMDate: string;
  estimatedCost: number;
  priority: string;
  status: string;
}

interface TripData {
  id: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  tripStatus: string;
  totalTasks: number;
  totalCost: number;
  tasks: any[];
}

export function TechnicianTripDetailsModal({
  isOpen,
  onClose,
  technicianId
}: TechnicianTripDetailsModalProps) {
  const [selectedTrip, setSelectedTrip] = useState<TripData | null>(null);
  const [miscellaneousCost, setMiscellaneousCost] = useState<number>(0);
  const { toast } = useToast();

  // Fetch technician details
  const { data: technicianData, isLoading: technicianLoading } = useQuery({
    queryKey: ["/api/technicians", technicianId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/technicians/${technicianId}`);
      return await res.json();
    },
    enabled: isOpen && !!technicianId,
  });

  // Fetch technician's assigned services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/scheduling/technicians", technicianId, "services"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduling/technicians/${technicianId}/services`);
      return await res.json();
    },
    enabled: isOpen && !!technicianId,
  });

  // Fetch technician's assigned PM tasks
  const { data: pmTasksData, isLoading: pmTasksLoading } = useQuery({
    queryKey: ["/api/scheduling/technicians", technicianId, "pm-tasks"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduling/technicians/${technicianId}/pm-tasks`);
      return await res.json();
    },
    enabled: isOpen && !!technicianId,
  });

  // Fetch technician's upcoming/planned trips
  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ["/api/scheduling/travel/trips", { technicianId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduling/travel/trips?technicianId=${technicianId}&status=planned,confirmed`);
      return await res.json();
    },
    enabled: isOpen && !!technicianId,
  });

  const technician = technicianData as TechnicianData;
  const services = servicesData?.services || [];
  const pmTasks = pmTasksData?.pmTasks || [];
  const trips = tripsData?.trips || [];

  // Group services by city
  const servicesByCity = services.reduce((acc: any, service: ServiceRequest) => {
    const city = service.customer?.city || service.container?.currentLocation?.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = {
        city,
        services: [],
        totalCost: 0,
        clientCount: new Set()
      };
    }
    acc[city].services.push(service);
    acc[city].totalCost += service.estimatedCost || 0;
    acc[city].clientCount.add(service.customer?.companyName);
    return acc;
  }, {});

  // Group PM tasks by city
  const pmTasksByCity = pmTasks.reduce((acc: any, task: PMTask) => {
    const city = task.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = {
        city,
        tasks: [],
        totalCost: 0,
        clientCount: new Set()
      };
    }
    acc[city].tasks.push(task);
    acc[city].totalCost += task.estimatedCost || 0;
    acc[city].clientCount.add(task.customerName);
    return acc;
  }, {});

  const handleGenerateTripPDF = async (trip: TripData) => {
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your PDF...",
      });

      const res = await apiRequest("POST", "/api/trips/generate-finance-pdf", {
        tripId: trip.id,
        trip,
        technician,
      });

      if (res.ok) {
        // Create blob from response and trigger download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Trip-Details-${technician?.name || 'Technician'}-${trip.destinationCity}.pdf`;
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Technician Trip Details
            </DialogTitle>
            <DialogDescription>
              Complete overview of technician assignments and upcoming trips
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* A. Technician Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Technician Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {technicianLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : technician ? (
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

            {/* B. Assigned Services (Grouped by City) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Assigned Services ({services.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-20 bg-gray-200 rounded"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </div>
                ) : Object.keys(servicesByCity).length > 0 ? (
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
                          {cityGroup.services.slice(0, 3).map((service: ServiceRequest) => (
                            <div key={service.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div className="flex items-center gap-3">
                                <Badge className={getPriorityColor(service.priority)}>
                                  {service.priority}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {service.container?.containerCode}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {service.customer?.companyName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(service.status)}>
                                  {service.status}
                                </Badge>
                                <span className="text-sm font-medium">
                                  ₹{service.estimatedCost?.toLocaleString() || '0'}
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

            {/* C. Assigned PM Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Assigned PM Tasks ({pmTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pmTasksLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-16 bg-gray-200 rounded"></div>
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                ) : Object.keys(pmTasksByCity).length > 0 ? (
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
                          {cityGroup.tasks.slice(0, 3).map((task: PMTask) => (
                            <div key={task.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div className="flex items-center gap-3">
                                <Badge className={getPriorityColor(task.priority)}>
                                  {task.priority}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {task.containerCode}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {task.customerName}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  Last PM: {new Date(task.lastPMDate).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(task.status)}>
                                  {task.status}
                                </Badge>
                                <span className="text-sm font-medium">
                                  ₹{task.estimatedCost?.toLocaleString() || '0'}
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
                  <p className="text-muted-foreground">No assigned PM tasks</p>
                )}
              </CardContent>
            </Card>

            {/* D. Upcoming / Planned Trips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming / Planned Trips ({trips.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tripsLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-16 bg-gray-200 rounded"></div>
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                ) : trips.length > 0 ? (
                  <div className="space-y-4">
                    {trips.map((trip: TripData) => (
                      <div key={trip.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{trip.destinationCity}</span>
                                <Badge className={getStatusColor(trip.tripStatus)}>
                                  {trip.tripStatus}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>
                                  {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                                </span>
                                <span>{trip.totalTasks} tasks</span>
                                <div className="flex items-center gap-1">
                                  <IndianRupee className="h-3 w-3" />
                                  {trip.totalCost?.toLocaleString('en-IN') || '0'}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedTrip(trip)}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Trip Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No upcoming trips</p>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* E. Full Trip Details Modal */}
      <Dialog open={!!selectedTrip} onOpenChange={() => setSelectedTrip(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Trip Details: {selectedTrip?.destinationCity}
            </DialogTitle>
            <DialogDescription>
              Complete trip information and cost breakdown
            </DialogDescription>
          </DialogHeader>

          {selectedTrip && (
            <div className="space-y-6">
              {/* Technician Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Technician Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{technician?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Employee Code</p>
                      <p className="font-mono">{technician?.employeeCode}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Grade</p>
                      <p>{technician?.grade}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contact</p>
                      <p>{technician?.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trip Tasks by Day */}
              <Card>
                <CardHeader>
                  <CardTitle>Tasks by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* This would need to be populated with actual daily task breakdown */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">
                          {new Date(selectedTrip.startDate).toLocaleDateString()} - {new Date(selectedTrip.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{selectedTrip.totalTasks} tasks assigned for this period</p>
                        <p>Travel distance/time information would be displayed here</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Service Cost</Label>
                        <p className="text-lg font-medium">₹0</p>
                      </div>
                      <div>
                        <Label>PM Cost</Label>
                        <p className="text-lg font-medium">₹0</p>
                      </div>
                      <div>
                        <Label>Travel Allowance</Label>
                        <p className="text-lg font-medium">₹{selectedTrip.totalCost?.toLocaleString() || '0'}</p>
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
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Total Cost</span>
                      <span className="text-xl font-bold">
                        ₹{(selectedTrip.totalCost + miscellaneousCost).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Generate PDF Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedTrip(null)}>
                  Close
                </Button>
                <Button onClick={() => handleGenerateTripPDF(selectedTrip)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Generate PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
