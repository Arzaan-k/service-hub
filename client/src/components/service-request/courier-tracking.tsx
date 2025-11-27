import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CourierShipment {
  id: string;
  awbNumber: string;
  courierName: string;
  courierCode?: string;
  shipmentDescription?: string;
  origin?: string;
  destination?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: string;
  currentLocation?: string;
  trackingHistory?: Array<{
    timestamp: string;
    status: string;
    location?: string;
    description: string;
  }>;
  lastTrackedAt?: string;
  createdAt: string;
}

interface CourierTrackingProps {
  serviceRequestId: string;
}

export default function CourierTracking({ serviceRequestId }: CourierTrackingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    awbNumber: "",
    courierName: "",
    shipmentDescription: "",
    origin: "",
    destination: "",
  });

  // Fetch courier shipments for this service request
  const { data: shipments = [], isLoading } = useQuery<CourierShipment[]>({
    queryKey: [`/api/service-requests/${serviceRequestId}/courier-shipments`],
  });

  // Add shipment mutation
  const addShipmentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest(
        "POST",
        `/api/service-requests/${serviceRequestId}/courier-shipments`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/courier-shipments`] });
      setIsAddDialogOpen(false);
      setFormData({
        awbNumber: "",
        courierName: "",
        shipmentDescription: "",
        origin: "",
        destination: "",
      });
      toast({
        title: "Success",
        description: "Courier shipment added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Refresh tracking mutation
  const refreshTrackingMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      const response = await apiRequest("POST", `/api/courier-shipments/${shipmentId}/refresh`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/courier-shipments`] });
      toast({
        title: "Success",
        description: "Tracking data refreshed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete shipment mutation
  const deleteShipmentMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      const response = await apiRequest("DELETE", `/api/courier-shipments/${shipmentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/courier-shipments`] });
      toast({
        title: "Success",
        description: "Shipment removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: "bg-gray-500",
      in_transit: "bg-blue-500",
      out_for_delivery: "bg-yellow-500",
      delivered: "bg-green-500",
      failed: "bg-red-500",
      cancelled: "bg-gray-600",
      returned: "bg-orange-500",
    };
    return statusColors[status] || "bg-gray-500";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleAddShipment = () => {
    if (!formData.awbNumber || !formData.courierName) {
      toast({
        title: "Validation Error",
        description: "AWB Number and Courier Name are required",
        variant: "destructive",
      });
      return;
    }
    addShipmentMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Courier Tracking</h3>
          <p className="text-sm text-muted-foreground">Track spare parts shipments</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <i className="fas fa-plus mr-2"></i>
              Add Shipment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Courier Shipment</DialogTitle>
              <DialogDescription>
                Enter AWB number to track a new shipment. We support all major Indian couriers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="awbNumber">AWB / Tracking Number *</Label>
                <Input
                  id="awbNumber"
                  placeholder="e.g., DEL123456789"
                  value={formData.awbNumber}
                  onChange={(e) => setFormData({ ...formData, awbNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="courierName">Courier Service *</Label>
                <Input
                  id="courierName"
                  placeholder="e.g., Delhivery, BlueDart, DTDC"
                  value={formData.courierName}
                  onChange={(e) => setFormData({ ...formData, courierName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipmentDescription">Description</Label>
                <Textarea
                  id="shipmentDescription"
                  placeholder="What parts are being shipped?"
                  value={formData.shipmentDescription}
                  onChange={(e) => setFormData({ ...formData, shipmentDescription: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin">Origin</Label>
                  <Input
                    id="origin"
                    placeholder="e.g., Mumbai"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    placeholder="e.g., Delhi"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddShipment} disabled={addShipmentMutation.isPending}>
                {addShipmentMutation.isPending ? "Adding..." : "Add Shipment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {shipments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <i className="fas fa-shipping-fast text-4xl mb-4 opacity-50"></i>
              <p>No shipments tracked yet</p>
              <p className="text-sm mt-2">Add a courier tracking number to monitor your spare parts delivery</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {shipments.map((shipment) => (
            <Card key={shipment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <i className="fas fa-box text-primary"></i>
                      {shipment.awbNumber}
                      <Badge className={getStatusColor(shipment.status)}>
                        {shipment.status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {shipment.courierName} {shipment.courierCode && `(${shipment.courierCode})`}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshTrackingMutation.mutate(shipment.id)}
                      disabled={refreshTrackingMutation.isPending}
                    >
                      <i className="fas fa-sync-alt mr-2"></i>
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to remove this shipment?")) {
                          deleteShipmentMutation.mutate(shipment.id);
                        }
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {shipment.shipmentDescription && (
                  <div>
                    <p className="text-sm font-medium mb-1">Description:</p>
                    <p className="text-sm text-muted-foreground">{shipment.shipmentDescription}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {shipment.origin && (
                    <div>
                      <p className="font-medium">Origin</p>
                      <p className="text-muted-foreground">{shipment.origin}</p>
                    </div>
                  )}
                  {shipment.destination && (
                    <div>
                      <p className="font-medium">Destination</p>
                      <p className="text-muted-foreground">{shipment.destination}</p>
                    </div>
                  )}
                  {shipment.currentLocation && (
                    <div>
                      <p className="font-medium">Current Location</p>
                      <p className="text-muted-foreground">{shipment.currentLocation}</p>
                    </div>
                  )}
                  {shipment.estimatedDeliveryDate && (
                    <div>
                      <p className="font-medium">Est. Delivery</p>
                      <p className="text-muted-foreground">{formatDate(shipment.estimatedDeliveryDate)}</p>
                    </div>
                  )}
                </div>

                {shipment.trackingHistory && shipment.trackingHistory.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="font-medium mb-3">Tracking History</p>
                      <div className="space-y-3">
                        {shipment.trackingHistory.map((event, index) => (
                          <div key={index} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                              {index !== shipment.trackingHistory!.length - 1 && (
                                <div className="w-px h-full bg-border mt-1"></div>
                              )}
                            </div>
                            <div className="flex-1 pb-3">
                              <p className="text-sm font-medium">{event.description}</p>
                              {event.location && (
                                <p className="text-xs text-muted-foreground">{event.location}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(event.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {shipment.lastTrackedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {formatDate(shipment.lastTrackedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
