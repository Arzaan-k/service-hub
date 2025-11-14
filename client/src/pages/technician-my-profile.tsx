import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Star, Wrench, Save, Edit } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import WageBreakdown from "@/components/wage-breakdown";
import MapMyIndiaAutocomplete from "@/components/map-my-india-autocomplete";

interface Technician {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsappNumber: string;
  experienceLevel: string;
  status: string;
  rating: number;
  servicesCompleted: number;
  specialization: string;
  baseLocation: string | { city: string };
  skills: string[];
}

export default function TechnicianMyProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    baseLocation: "",
  });

  const currentUser = getCurrentUser();

  // Get technician data by user ID
  const { data: technician, isLoading, error } = useQuery({
    queryKey: ["/api/technicians/user", currentUser?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/technicians/user/${currentUser?.id}`);
      return await res.json();
    },
    enabled: !!currentUser?.id,
  });

  const updateTechnician = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/technicians/${technician?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/user", currentUser?.id] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (technician) {
      setFormData({
        baseLocation: typeof technician.baseLocation === "string"
          ? technician.baseLocation
          : technician.baseLocation?.city || "",
      });
    }
  }, [technician]);

  const handleSave = () => {
    updateTechnician.mutate({
      baseLocation: formData.baseLocation,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="My Profile" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !technician) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="My Profile" />
          <div className="p-6">
            <div className="text-destructive">Failed to load profile.</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="My Profile" />
        <div className="p-6 space-y-6">
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
                        value={formData.baseLocation}
                        onChange={(value) => setFormData({ ...formData, baseLocation: value })}
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
                <span>{technician.averageRating ?? technician.rating ?? 0}/5</span>
              </div>

              {/* Edit/Save Buttons */}
              <div className="flex gap-2 pt-4">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={updateTechnician.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {updateTechnician.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wage Breakdown Section */}
          <WageBreakdown technicianId={technician.id} />
        </div>
      </main>
    </div>
  );
}
