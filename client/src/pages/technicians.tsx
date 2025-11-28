import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, MapPin, Star, Wrench, Plus, UserPlus, UserCog, IndianRupee } from "lucide-react";
import { Link, useLocation } from "wouter";
import { getAuthToken } from "@/lib/auth";
import ThirdPartyTechnicianForm from "@/components/technicians/third-party-technician-form";
import { websocket } from "@/lib/websocket";

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
  baseLocation: string;
}

export default function Technicians() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddThirdPartyDialogOpen, setIsAddThirdPartyDialogOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    whatsappNumber: "",
    experienceLevel: "mid",
    specialization: "general",
    baseLocation: "",
    role: "technician", // Default to regular technician
  });
  const [thirdPartyFormData, setThirdPartyFormData] = useState({
    contactName: "",
    phone: "",
    email: "",
    whatsappNumber: "",
    specialization: "general",
    baseLocation: "",
    moneyAllowance: "",
  });

  // Set up test user for development
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setAuthToken(token);
    }
    setAuthReady(true);
  }, []);

  const { data: technicians, isLoading, error } = useQuery({
    queryKey: ["/api/technicians"],
    enabled: authReady && !!authToken,
    retry: false,
    onSuccess: (data) => {
      console.log("Technicians loaded successfully:", data);
    },
    onError: (error) => {
      console.error("Error loading technicians:", error);
    },
  });

  // Fetch cities for location dropdown
  const { data: citiesData = [] } = useQuery({
    queryKey: ["/api/containers/cities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/containers/cities");
      return await res.json();
    },
    enabled: authReady && !!authToken,
  });

  const cities = Array.isArray(citiesData) ? citiesData.map((c: any) => c.city_name || c.city || c).filter(Boolean).sort() : [];

  // Fetch assigned services summary for all technicians (single request)
  const { data: assignedServicesData, refetch: refetchAssignedServices } = useQuery({
    queryKey: ["/api/technicians/assigned-services-summary"],
    enabled: authReady && !!authToken,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technicians/assigned-services-summary");
      if (!res.ok) throw new Error("Failed to fetch assigned services summary");
      const data = await res.json();
      console.log("[Technicians] Assigned services data received:", data);
      console.log("[Technicians] Number of technicians with data:", Object.keys(data || {}).length);
      // Log each technician's assigned services
      Object.keys(data || {}).forEach(techId => {
        const techData = data[techId];
        if (techData) {
          const serviceCount = techData.count || 0;
          const totalServices = Array.isArray(techData.services) ? techData.services.length : 0;
          console.log(`[Technicians] Tech ${techId}: ${serviceCount} active, ${totalServices} total services`);
          if (serviceCount > 0 || totalServices > 0) {
            console.log(`[Technicians] Tech ${techId} services:`, 
              techData.services?.map((s: any) => `${s.requestNumber || s.id} (${s.status})`) || []);
          }
        }
      });
      return data;
    },
    staleTime: 0, // Always consider stale to allow immediate refetch
    refetchInterval: 10_000, // Refetch every 10 seconds
    refetchIntervalInBackground: true,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  });

  // Listen for service assignment events to refresh assigned services
  // This must be AFTER refetchAssignedServices is defined
  useEffect(() => {
    if (!refetchAssignedServices) return;
    
    const handleServiceAssigned = () => {
      console.log("[Technicians] Service assigned event received, refreshing assigned services...");
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
      refetchAssignedServices();
    };

    const handleTechnicianUpdated = () => {
      console.log("[Technicians] Technician updated event received, refreshing technicians list...");
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/location-overview"] });
    };

    websocket.on("service_request_assigned", handleServiceAssigned);
    websocket.on("service_request_updated", handleServiceAssigned);
    websocket.on("technician_updated", handleTechnicianUpdated);

    return () => {
      websocket.off("service_request_assigned", handleServiceAssigned);
      websocket.off("service_request_updated", handleServiceAssigned);
      websocket.off("technician_updated", handleTechnicianUpdated);
    };
  }, [queryClient, refetchAssignedServices]);

  const { data: thirdPartyTechs, isLoading: isLoadingThirdParty, error: thirdPartyError } = useQuery({
    queryKey: ["/api/thirdparty-technicians"],
    enabled: authReady && !!authToken,
    retry: false,
    onSuccess: (data) => {
      console.log("Third-party technicians loaded successfully:", data);
    },
    onError: (error) => {
      console.error("Error loading third-party technicians:", error);
    },
  });

  const createTechnician = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating technician with data:", data);
      const res = await apiRequest("POST", "/api/technicians", data);
      console.log("Technician creation response:", res);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Failed to create technician");
      }
      const technicianData = await res.json();

      // Return technician data - user account is already handled by backend
      return {
        ...technicianData,
        name: technicianData.name ?? technicianData.user?.name,
        email: technicianData.email ?? technicianData.user?.email,
        phone: technicianData.phone ?? technicianData.user?.phoneNumber,
        specialization: Array.isArray(technicianData.skills) ? technicianData.skills[0] : technicianData.specialization,
        baseLocation: typeof technicianData.baseLocation === 'object' ? technicianData.baseLocation?.city : technicianData.baseLocation,
      };
    },
    onSuccess: (result) => {
      console.log("Technician created successfully:", result);
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      setIsAddDialogOpen(false);
      resetForm();

      // Build success message based on what happened
      let successMessage = "Technician added successfully.";

      if (result.userCreated && result.resetLinkSent) {
        successMessage = "Technician added. User account created and password setup link sent via email.";
      } else if (result.userCreated && !result.resetLinkSent) {
        successMessage = `Technician added. User account created but email failed. ${result.emailError || 'Check server logs for reset link.'}`;
        // Log reset link for development
        if (result.resetLink) {
          console.log('🔗 Technician password setup link:', result.resetLink);
        }
      } else if (result.userReused) {
        successMessage = "Technician added. Existing user account reused.";
      }

      toast({
        title: "Success",
        description: successMessage,
      });
    },
    onError: (error: any) => {
      console.error("Technician creation error:", error);
      const errorMessage = error?.message || error?.response?.data?.details || "Failed to add technician";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createThirdPartyTechnician = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        specialization: data.specialization,
        baseLocation: data.baseLocation,
        moneyAllowance: data.moneyAllowance ? parseFloat(data.moneyAllowance) : undefined,
      };
      if (!payload.contactName || !payload.phone || payload.moneyAllowance === undefined || Number.isNaN(payload.moneyAllowance)) {
        throw new Error("Contact person, phone, and valid money allowance are required");
      }
      const res = await apiRequest("POST", "/api/thirdparty-technicians", payload);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Failed to create third-party technician");
      }
      const json = await res.json();
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/thirdparty-technicians"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      setIsAddThirdPartyDialogOpen(false);
      setThirdPartyFormData({
        contactName: "",
        phone: "",
        email: "",
        whatsappNumber: "",
        specialization: "general",
        baseLocation: "",
        moneyAllowance: "",
      });
      toast({
        title: "Success",
        description: "Third-party technician added successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.details || "Failed to add third-party technician";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateTechnician = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = {
        experienceLevel: data.experienceLevel,
        specialization: data.specialization,
        baseLocation: data.baseLocation, // This will be a string from the Select dropdown
        status: data.status,
        averageRating: data.rating,
        totalJobsCompleted: data.servicesCompleted,
        name: data.name,
        email: data.email,
        phone: data.phone,
        whatsappNumber: data.whatsappNumber,
      };
      console.log("Updating technician with payload:", payload);
      const res = await apiRequest("PUT", `/api/technicians/${id}`, payload);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update technician");
      }
      const json = await res.json();
      return {
        ...json,
        name: json.name ?? data.name,
        email: json.email ?? data.email,
        phone: json.phone ?? data.phone,
        specialization: Array.isArray(json.skills) ? json.skills[0] : data.specialization,
        baseLocation: typeof json.baseLocation === 'object' ? json.baseLocation?.city : data.baseLocation,
      };
    },
    onSuccess: async () => {
      // Invalidate all related queries to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/technicians/location-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] });
      // Refetch immediately to ensure fresh data
      await queryClient.refetchQueries({ queryKey: ["/api/technicians"] });
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Technician location updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("[Technicians] Failed to update technician:", error);
      const errorMessage = error?.message || error?.response?.data?.error || "Failed to update technician";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteTechnician = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/technicians/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "Success",
        description: "Technician deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete technician",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      whatsappNumber: "",
      experienceLevel: "mid",
      specialization: "general",
      baseLocation: "",
      role: "technician",
    });
    setSelectedTech(null);
  };

  const handleAdd = () => {
    try {
      console.log("Submitting technician form with data:", formData);
      createTechnician.mutate(formData);
    } catch (error) {
      console.error("Error in handleAdd:", error);
      toast({
        title: "Error",
        description: "Failed to submit technician form",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (tech: Technician) => {
    setSelectedTech(tech);
    setFormData({
      name: tech.name,
      phone: tech.phone,
      email: tech.email,
      whatsappNumber: (tech as any).whatsappNumber,
      experienceLevel: (tech as any).experienceLevel,
      specialization: (tech as any).specialization || ((tech as any).skills?.[0] ?? "general"),
      baseLocation: typeof (tech as any).baseLocation === "string" ? (tech as any).baseLocation : (tech as any).baseLocation?.city || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (selectedTech) {
      console.log("[Technicians] Updating technician:", {
        id: selectedTech.id,
        location: formData.baseLocation,
        formData: formData
      });
      updateTechnician.mutate({ id: selectedTech.id, data: formData });
    }
  };

  const handleAddThirdParty = () => {
    try {
      // Client-side validation
      const allowanceNumber = parseFloat(thirdPartyFormData.moneyAllowance as any);
      if (!thirdPartyFormData.contactName || !thirdPartyFormData.phone || !thirdPartyFormData.moneyAllowance || Number.isNaN(allowanceNumber)) {
        toast({
          title: "Validation Error",
          description: "Contact person, phone, and a valid money allowance are required.",
          variant: "destructive",
        });
        return;
      }
      createThirdPartyTechnician.mutate(thirdPartyFormData);
    } catch (error) {
      console.error("Error in handleAddThirdParty:", error);
      toast({
        title: "Error",
        description: "Failed to submit third-party technician form",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this technician?")) {
      deleteTechnician.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      available: "status-available border-0",
      busy: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
      offline: "bg-gray-200 text-gray-700 border-gray-300",
    };
    return statusMap[status] || statusMap.available;
  };

  const getExperienceColor = (level: string) => {
    const colorMap: Record<string, string> = {
      junior: "text-blue-200",
      mid: "text-green-200",
      senior: "text-orange-200",
      expert: "text-purple-200",
    };
    return colorMap[level] || colorMap.mid;
  };

  if (isLoading || isLoadingThirdParty) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Technicians" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || thirdPartyError) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Technicians" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Technicians</h3>
              <p className="text-muted-foreground mb-4">{(error as any)?.message || (thirdPartyError as any)?.message}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Technician Management" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Technicians</h2>
              <p className="text-sm text-muted-foreground">
                👷 Internal Technicians: {(technicians as any[])?.length ?? 0} • 🧰 Third-Party Technicians: {(thirdPartyTechs as any[])?.length ?? 0}
              </p>
            </div>
          </div>

          {/* Assignment Distribution Summary */}
          {assignedServicesData && technicians && (
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">📊 Assignment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Active Assignments</div>
                    <div className="text-2xl font-bold text-primary">
                      {Object.values(assignedServicesData).reduce((sum: number, techData: any) => sum + (techData?.count || 0), 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Average per Technician</div>
                    <div className="text-2xl font-bold text-primary">
                      {technicians.length > 0 
                        ? Math.round((Object.values(assignedServicesData).reduce((sum: number, techData: any) => sum + (techData?.count || 0), 0) / technicians.length) * 10) / 10
                        : 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Technicians with Assignments</div>
                    <div className="text-2xl font-bold text-primary">
                      {Object.values(assignedServicesData || {}).filter((techData: any) => (techData?.count || 0) > 0).length} / {((technicians as any[])?.length || 0) + ((thirdPartyTechs as any[])?.length || 0)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="text-xs text-muted-foreground mb-2">Assignment Count by Technician:</div>
                  <div className="flex flex-wrap gap-2">
                    {/* Internal Technicians */}
                    {(technicians as any[]).map((tech: any) => {
                      const count = assignedServicesData?.[tech.id]?.count ?? 0;
                      return (
                        <Badge key={tech.id} variant={count > 0 ? "default" : "outline"} className="text-xs">
                          {tech.name || tech.employeeCode}: {count}
                        </Badge>
                      );
                    })}
                    {/* Third-Party Technicians */}
                    {(thirdPartyTechs as any[]).map((tp: any) => {
                      const tpTechId = tp.id || tp._id;
                      const count = assignedServicesData?.[tpTechId]?.count ?? 0;
                      return (
                        <Badge key={tpTechId} variant={count > 0 ? "default" : "outline"} className="text-xs" style={{ backgroundColor: count > 0 ? '#FFD4E3' : undefined }}>
                          {tp.name || tp.contactName} (TP): {count}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mb-6 flex items-center justify-between">
            <div></div>
            <div className="flex justify-end gap-3">
              <button
                className="flex items-center gap-2 bg-gradient-to-r from-[#FFD4E3] to-[#FFC6B3] text-[#3A3A3A] hover:opacity-90 font-medium px-4 py-2 rounded-xl shadow-sm transition-all duration-300"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <UserPlus className="w-4 h-4" />
                Add Technician
              </button>
              <button
                className="flex items-center gap-2 bg-gradient-to-r from-[#FFD4E3] to-[#FFA07A] text-[#3A3A3A] hover:opacity-90 font-medium px-4 py-2 rounded-xl shadow-sm transition-all duration-300"
                onClick={() => setIsAddThirdPartyDialogOpen(true)}
              >
                <UserCog className="w-4 h-4" />
                Add Third-Party Technician
              </button>
            </div>
          </div>

          {/* Internal Technicians */}
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-foreground mb-3">Internal Technicians</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {technicians && (technicians as any[]).length > 0 ? (
                (technicians as any[]).map((tech: Technician) => (
                  <Card key={tech.id} className="shadow-sm hover:shadow-md transition-all bg-card border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 border border-primary/20">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <Link href={`/technicians/${tech.id}`}>
                              <CardTitle className="text-lg cursor-pointer hover:underline">{tech.name}</CardTitle>
                            </Link>
                            <p className="text-sm font-medium text-muted-foreground">
                              {(tech as any).experienceLevel?.toUpperCase?.() || "MID"}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${getStatusBadge(tech.status)} rounded-full`}>
                          {tech.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Location - Prominent */}
                      <div className="flex items-center gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          {typeof (tech as any).baseLocation === "string"
                            ? ((tech as any).baseLocation || "📍 Not set - Click Edit")
                            : ((tech as any).baseLocation?.city || "📍 Not set - Click Edit")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{tech.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {(tech as any).specialization || Array.isArray((tech as any).skills) ? (tech as any).skills?.join(", ") : "general"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium">{(tech as any).rating ?? (tech as any).averageRating ?? 0}/5</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(tech as any).servicesCompleted ?? (tech as any).totalJobsCompleted ?? 0} services
                        </span>
                      </div>
                      {/* Assigned Services Section */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">Assigned Services</span>
                          <Badge variant="outline" className="text-xs">
                            {(() => {
                              const count = assignedServicesData?.[tech.id]?.count ?? assignedServicesData?.[tech.id]?.services?.length ?? 0;
                              return `${count} ${count === 1 ? 'service' : 'services'}`;
                            })()}
                          </Badge>
                        </div>
                        {(() => {
                          const techServices = assignedServicesData?.[tech.id]?.services;
                          const hasServices = techServices && Array.isArray(techServices) && techServices.length > 0;
                          
                          if (!hasServices) {
                            return (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                No assigned services
                              </div>
                            );
                          }
                          
                          return (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {techServices.slice(0, 3).map((service: any) => (
                                <Link key={service.id} href={`/service-requests/${service.id}`} className="block">
                                  <div className="text-xs p-2 bg-muted/50 rounded border border-border hover:bg-muted/70 hover:border-primary transition-colors cursor-pointer">
                                    <div className="font-medium text-foreground truncate">
                                      {service.requestNumber || service.id?.slice(0, 8) || 'N/A'}
                                    </div>
                                    <div className="text-muted-foreground truncate">
                                      {service.containerCode || 'N/A'} • <span className="capitalize">{service.status || 'pending'}</span>
                                    </div>
                                    {service.issueDescription && (
                                      <div className="text-muted-foreground truncate text-[10px] mt-1">
                                        {service.issueDescription.substring(0, 50)}...
                                      </div>
                                    )}
                                    {service.scheduledDate && (
                                      <div className="text-muted-foreground text-[10px] mt-1">
                                        📅 {new Date(service.scheduledDate).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              ))}
                              {techServices.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center pt-1">
                                  +{techServices.length - 3} more
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => handleEdit(tech)}
                          className="w-full bg-gradient-to-r from-peach-200 to-peach-300 text-black font-medium py-2 rounded-2xl shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-6 text-sm text-muted-foreground">
                  No internal technicians found.
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 border-t border-border"></div>

          {/* Third-Party Technicians */}
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-foreground mb-3">Third-Party Technicians</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {thirdPartyTechs && (thirdPartyTechs as any[]).length > 0 ? (
                (thirdPartyTechs as any[]).map((tp: any) => {
                  const tpTechId = tp.id || tp._id;
                  const tpServices = assignedServicesData?.[tpTechId];
                  const tpServiceCount = tpServices?.count ?? tpServices?.services?.length ?? 0;
                  return (
                  <Card
                    key={tp.id}
                    className="shadow-sm hover:shadow-md transition-all bg-card hover:bg-accent/5 cursor-pointer hover:shadow-lg transform hover:-translate-y-1 duration-200 border-border"
                    onClick={() => setLocation(`/technicians/${tp.id || tp._id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 border border-primary/20">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{tp.name || tp.contactName}</CardTitle>
                            <p className="text-sm font-medium text-muted-foreground">
                              {(tp as any).specialization || "general"}
                            </p>
                          </div>
                        </div>
                        <Badge className="rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          Third-Party
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{tp.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {typeof tp.baseLocation === "string"
                            ? (tp.baseLocation || "Not set")
                            : (tp.baseLocation?.city || "Not set")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">Money Allowance (₹): {(tp as any).moneyAllowance ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium">{(tp as any).rating ?? 0}/5</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(tp as any).servicesCompleted ?? 0} services
                        </span>
                      </div>
                      {/* Assigned Services Section */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">Assigned Services</span>
                          <Badge variant="outline" className="text-xs">
                            {tpServiceCount} {tpServiceCount === 1 ? 'service' : 'services'}
                          </Badge>
                        </div>
                        {(() => {
                          const techServices = tpServices?.services;
                          const hasServices = techServices && Array.isArray(techServices) && techServices.length > 0;
                          
                          if (!hasServices) {
                            return (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                No assigned services
                              </div>
                            );
                          }
                          
                          return (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {techServices.slice(0, 3).map((service: any) => (
                                <Link key={service.id} href={`/service-requests/${service.id}`} className="block">
                                  <div className="text-xs p-2 bg-muted/50 rounded border border-border hover:bg-muted/70 hover:border-primary transition-colors cursor-pointer">
                                    <div className="font-medium text-foreground truncate">
                                      {service.requestNumber || service.id?.slice(0, 8) || 'N/A'}
                                    </div>
                                    <div className="text-muted-foreground truncate">
                                      {service.containerCode || 'N/A'} • <span className="capitalize">{service.status || 'pending'}</span>
                                    </div>
                                    {service.issueDescription && (
                                      <div className="text-muted-foreground truncate text-[10px] mt-1">
                                        {service.issueDescription.substring(0, 50)}...
                                      </div>
                                    )}
                                    {service.scheduledDate && (
                                      <div className="text-muted-foreground text-[10px] mt-1">
                                        📅 {new Date(service.scheduledDate).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              ))}
                              {techServices.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center py-1">
                                  +{techServices.length - 3} more
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => setLocation(`/technicians/${tp.id}`)}
                          className="w-full bg-gradient-to-r from-peach-200 to-peach-300 text-black font-medium py-2 rounded-2xl shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-6 text-sm text-muted-foreground">
                  No third-party technicians found.
                </div>
              )}
            </div>
          </div>

          {/* Overall empty state */}
          {(!(technicians as any[])?.length && !(thirdPartyTechs as any[])?.length) && (
            <div className="col-span-full text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Technicians Found</h3>
              <p className="text-muted-foreground mb-4">Get started by adding your first technician</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Technician
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Add Technician Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md modal-content modal">
          <DialogHeader>
            <DialogTitle>Add New Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="experience">Experience Level</Label>
              <Select
                value={formData.experienceLevel}
                onValueChange={(value) => setFormData({ ...formData, experienceLevel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="senior_technician">Senior Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="e.g., Refrigeration, General"
              />
            </div>
            <div>
              <Label htmlFor="location">Current City / Location *</Label>
              <Select
                value={formData.baseLocation}
                onValueChange={(value) => setFormData({ ...formData, baseLocation: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city..." />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city: string) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cities.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No cities available. Using containers will populate this list.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createTechnician.isPending}>
              {createTechnician.isPending ? "Adding..." : "Add Technician"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Third-Party Technician Dialog */}
      <Dialog open={isAddThirdPartyDialogOpen} onOpenChange={setIsAddThirdPartyDialogOpen}>
        <DialogContent className="max-w-md modal-content modal">
          <DialogHeader>
            <DialogTitle>Add Third-Party Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ThirdPartyTechnicianForm
              value={thirdPartyFormData}
              onChange={setThirdPartyFormData}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddThirdPartyDialogOpen(false)}>
              Cancel
            </Button>
            <button
              className="flex items-center gap-2 bg-gradient-to-r from-[#FFD4E3] to-[#FFA07A] text-[#3A3A3A] hover:opacity-90 font-medium px-4 py-2 rounded-xl shadow-sm transition-all duration-300"
              onClick={handleAddThirdParty}
              disabled={createThirdPartyTechnician.isPending}
            >
              {createThirdPartyTechnician.isPending ? "Adding..." : "Add Third-Party Technician"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Technician Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md modal-content modal">
          <DialogHeader>
            <DialogTitle>Edit Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-whatsapp">WhatsApp Number</Label>
              <Input
                id="edit-whatsapp"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-experience">Experience Level</Label>
              <Select
                value={formData.experienceLevel}
                onValueChange={(value) => setFormData({ ...formData, experienceLevel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-specialization">Specialization</Label>
              <Input
                id="edit-specialization"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-location">Current City / Location *</Label>
              <Select
                value={formData.baseLocation}
                onValueChange={(value) => setFormData({ ...formData, baseLocation: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city..." />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city: string) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cities.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No cities available. Using containers will populate this list.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateTechnician.isPending}>
              {updateTechnician.isPending ? "Updating..." : "Update Technician"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}