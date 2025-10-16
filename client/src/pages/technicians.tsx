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
import { User, Phone, MapPin, Star, Wrench, Plus, Edit, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { saveAuth, getAuthToken } from "@/lib/auth";

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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
  });

  // Set up test user for development
  useEffect(() => {
    let token = getAuthToken();
    if (!token) {
      const testUserId = "test-admin-123";
      const testUser = { id: testUserId, name: "Test Admin", role: "admin" };
      saveAuth(testUserId, testUser);
      token = testUserId;
      // Fire-and-forget: create test user server-side (safe if already exists)
      fetch("/api/test/create-user", { method: "POST" }).catch(() => {});
    }
    setAuthToken(token);
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

  const createTechnician = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating technician with data:", data);
      const res = await apiRequest("POST", "/api/technicians", data);
      console.log("Technician creation response:", res);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Failed to create technician");
      }
      const json = await res.json();
      return {
        ...json,
        name: json.name ?? json.user?.name,
        email: json.email ?? json.user?.email,
        phone: json.phone ?? json.user?.phoneNumber,
        specialization: Array.isArray(json.skills) ? json.skills[0] : json.specialization,
        baseLocation: typeof json.baseLocation === 'object' ? json.baseLocation?.city : json.baseLocation,
      };
    },
    onSuccess: (data) => {
      console.log("Technician created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Technician added successfully",
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

  const updateTechnician = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = {
        experienceLevel: data.experienceLevel,
        specialization: data.specialization,
        baseLocation: data.baseLocation,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Technician updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update technician",
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
      updateTechnician.mutate({ id: selectedTech.id, data: formData });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this technician?")) {
      deleteTechnician.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      available: "bg-green-100 text-green-800 border-green-200",
      busy: "bg-yellow-100 text-yellow-800 border-yellow-200",
      offline: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return statusMap[status] || statusMap.available;
  };

  const getExperienceColor = (level: string) => {
    const colorMap: Record<string, string> = {
      junior: "text-blue-600",
      mid: "text-green-600",
      senior: "text-orange-600",
      expert: "text-purple-600",
    };
    return colorMap[level] || colorMap.mid;
  };

  if (isLoading) {
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

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Technicians" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Technicians</h3>
              <p className="text-muted-foreground mb-4">{error.message}</p>
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
              <p className="text-sm text-muted-foreground">Manage field technicians and their assignments</p>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Technician
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {technicians && technicians.length > 0 ? (
              technicians.map((tech: Technician) => (
                <Card key={tech.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <Link href={`/technicians/${tech.id}`}>
                            <CardTitle className="text-lg cursor-pointer hover:underline">{tech.name}</CardTitle>
                          </Link>
                          <p className={`text-sm font-medium ${getExperienceColor((tech as any).experienceLevel || "mid")}`}>
                            {(tech as any).experienceLevel?.toUpperCase?.() || "MID"}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getStatusBadge(tech.status)} border`}>
                        {tech.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{tech.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {typeof (tech as any).baseLocation === "string"
                        ? (tech as any).baseLocation
                        : (tech as any).baseLocation?.city || "Not set"}
                    </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">
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
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleEdit(tech)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(tech.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
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
        </div>
      </main>

      {/* Add Technician Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
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
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="e.g., Refrigeration, General"
              />
            </div>
            <div>
              <Label htmlFor="location">Base Location</Label>
              <Input
                id="location"
                value={formData.baseLocation}
                onChange={(e) => setFormData({ ...formData, baseLocation: e.target.value })}
                placeholder="City, State"
              />
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

      {/* Edit Technician Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
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
              <Label htmlFor="edit-location">Base Location</Label>
              <Input
                id="edit-location"
                value={formData.baseLocation}
                onChange={(e) => setFormData({ ...formData, baseLocation: e.target.value })}
              />
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