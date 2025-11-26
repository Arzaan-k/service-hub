import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlanTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PlanTripDialog({ open, onOpenChange, onSuccess }: PlanTripDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    technicianId: "",
    origin: "",
    destinationCity: "",
    startDate: "",
    endDate: "",
    purpose: "pm",
    notes: "",
    travelFare: "",
    stayCostPerNight: "",
    daPerDay: "",
    localTravelPerDay: "",
    miscCost: "",
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technicians");
      return await res.json();
    },
  });

  // Calculate costs
  const calculateCosts = () => {
    if (!formData.startDate || !formData.endDate) return { stayCost: 0, dailyAllowance: 0, localTravelCost: 0, total: 0 };

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const days = nights + 1;

    const stayCost = parseFloat(formData.stayCostPerNight || "0") * nights;
    const dailyAllowance = parseFloat(formData.daPerDay || "0") * days;
    const localTravelCost = parseFloat(formData.localTravelPerDay || "0") * days;
    const travelFare = parseFloat(formData.travelFare || "0");
    const miscCost = parseFloat(formData.miscCost || "0");

    const total = stayCost + dailyAllowance + localTravelCost + travelFare + miscCost;

    return { stayCost, dailyAllowance, localTravelCost, travelFare, miscCost, total };
  };

  const costs = calculateCosts();

  // Auto-fill origin from technician
  useEffect(() => {
    if (formData.technicianId) {
      const tech = technicians.find((t: any) => t.id === formData.technicianId);
      if (tech) {
        // Try multiple possible locations for origin
        const origin = tech.baseLocation?.city || 
                      tech.baseLocation?.address || 
                      tech.baseLocation ||
                      tech.homeLocation?.city ||
                      tech.homeLocation?.address ||
                      "";
        if (origin) {
          setFormData(prev => ({
            ...prev,
            origin: typeof origin === 'string' ? origin : (origin.city || origin.address || ""),
          }));
        }
      }
    }
  }, [formData.technicianId, technicians]);

  const createTrip = useMutation({
    mutationFn: async () => {
      const payload = {
        technicianId: formData.technicianId,
        origin: formData.origin,
        destinationCity: formData.destinationCity,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        purpose: formData.purpose,
        notes: formData.notes || undefined,
        travelFare: formData.travelFare ? parseFloat(formData.travelFare) : undefined,
        stayCost: costs.stayCost || undefined,
        dailyAllowance: costs.dailyAllowance || undefined,
        localTravelCost: costs.localTravelCost || undefined,
        miscCost: formData.miscCost ? parseFloat(formData.miscCost) : undefined,
      };

      const res = await apiRequest("POST", "/api/scheduling/travel/trips", payload);
      const trip = await res.json();
      
      // Auto-assign tasks
      try {
        await apiRequest("POST", `/api/scheduling/travel/trips/${trip.id}/auto-assign-tasks`);
      } catch (error) {
        console.error("Failed to auto-assign tasks:", error);
        // Don't fail the whole operation if auto-assign fails
      }

      return trip;
    },
    onSuccess: () => {
      toast({
        title: "Trip Created Successfully",
        description: "Technician trip has been created and tasks have been auto-assigned.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/travel/trips"] });
      onSuccess();
      // Reset form
      setFormData({
        technicianId: "",
        origin: "",
        destinationCity: "",
        startDate: "",
        endDate: "",
        purpose: "pm",
        notes: "",
        travelFare: "",
        stayCostPerNight: "",
        daPerDay: "",
        localTravelPerDay: "",
        miscCost: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Trip",
        description: error.message || "An error occurred while creating the trip",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.technicianId || !formData.destinationCity || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createTrip.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan Technician Trip</DialogTitle>
          <DialogDescription>
            Create a new multi-day trip for a technician with automatic cost calculation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="technicianId">Technician *</Label>
              <Select
                value={formData.technicianId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, technicianId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech: any) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name || tech.user?.name || tech.userName || tech.employeeCode || tech.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="origin">Origin *</Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                placeholder="Origin city/location"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="destinationCity">Destination City *</Label>
              <Input
                id="destinationCity"
                value={formData.destinationCity}
                onChange={(e) => setFormData(prev => ({ ...prev, destinationCity: e.target.value }))}
                placeholder="e.g., Chennai"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Select
                value={formData.purpose}
                onValueChange={(value) => setFormData(prev => ({ ...prev, purpose: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pm">PM (Preventive Maintenance)</SelectItem>
                  <SelectItem value="breakdown">Breakdown</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional instructions or notes..."
              rows={3}
            />
          </div>

          {/* Cost Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="travelFare">Travel Fare (₹)</Label>
                  <Input
                    id="travelFare"
                    type="number"
                    step="0.01"
                    value={formData.travelFare}
                    onChange={(e) => setFormData(prev => ({ ...prev, travelFare: e.target.value }))}
                    placeholder="Flight/Train/Bus fare"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stayCostPerNight">Stay Cost per Night (₹)</Label>
                  <Input
                    id="stayCostPerNight"
                    type="number"
                    step="0.01"
                    value={formData.stayCostPerNight}
                    onChange={(e) => setFormData(prev => ({ ...prev, stayCostPerNight: e.target.value }))}
                    placeholder="Hotel rate per night"
                  />
                  {formData.stayCostPerNight && formData.startDate && formData.endDate && (
                    <p className="text-xs text-muted-foreground">
                      Total: ₹{costs.stayCost.toFixed(2)} ({Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} nights)
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daPerDay">Daily Allowance per Day (₹)</Label>
                  <Input
                    id="daPerDay"
                    type="number"
                    step="0.01"
                    value={formData.daPerDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, daPerDay: e.target.value }))}
                    placeholder="DA rate per day"
                  />
                  {formData.daPerDay && formData.startDate && formData.endDate && (
                    <p className="text-xs text-muted-foreground">
                      Total: ₹{costs.dailyAllowance.toFixed(2)} ({Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="localTravelPerDay">Local Travel per Day (₹)</Label>
                  <Input
                    id="localTravelPerDay"
                    type="number"
                    step="0.01"
                    value={formData.localTravelPerDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, localTravelPerDay: e.target.value }))}
                    placeholder="Local travel rate per day"
                  />
                  {formData.localTravelPerDay && formData.startDate && formData.endDate && (
                    <p className="text-xs text-muted-foreground">
                      Total: ₹{costs.localTravelCost.toFixed(2)} ({Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="miscCost">Miscellaneous Cost (₹)</Label>
                <Input
                  id="miscCost"
                  type="number"
                  step="0.01"
                  value={formData.miscCost}
                  onChange={(e) => setFormData(prev => ({ ...prev, miscCost: e.target.value }))}
                  placeholder="Other expenses"
                />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total Estimated Cost:</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{costs.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTrip.isPending}>
              {createTrip.isPending ? "Creating..." : "Create Trip & Auto-Assign Tasks"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

