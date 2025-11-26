import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Wrench, MapPin, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function AssignTechnician() {
  const [, params] = useRoute("/assign-technician/:serviceId");
  const serviceId = (params as any)?.serviceId as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [internalTechs, setInternalTechs] = useState<any[]>([]);
  const [thirdPartyTechs, setThirdPartyTechs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTechs = async () => {
      try {
        const [intRes, thirdRes] = await Promise.all([
          apiRequest("GET", "/api/technicians"),
          apiRequest("GET", "/api/thirdparty-technicians"),
        ]);
        const internal = await intRes.json();
        const third = await thirdRes.json();
        setInternalTechs(Array.isArray(internal) ? internal : []);
        setThirdPartyTechs(Array.isArray(third) ? third : []);
      } catch (err) {
        console.error("Error loading technicians:", err);
        toast({ title: "Error", description: "Failed to load technicians", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTechs();
  }, []);

  const filteredInternal = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return internalTechs;
    return internalTechs.filter((t: any) => {
      const name = (t.name || "").toLowerCase();
      const spec = (t.specialization || (Array.isArray(t.skills) ? t.skills.join(", ") : "")).toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [searchTerm, internalTechs]);

  const filteredThird = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return thirdPartyTechs;
    return thirdPartyTechs.filter((t: any) => {
      const name = (t.name || t.contactName || "").toLowerCase();
      const spec = (t.specialization || "").toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [searchTerm, thirdPartyTechs]);

  const handleAssign = async (technicianId: string, type: "internal" | "thirdparty", name: string) => {
    try {
      // Use the unified assignment endpoint that handles both internal and third-party
      const res = await apiRequest("POST", `/api/assign-service`, { 
        serviceId, 
        technicianId, 
        type 
      });
      
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || json?.message || "Failed to assign");
      }
      
      const json = await res.json();
      
      // Invalidate and refetch queries to refresh data immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/technicians"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/technicians/assigned-services-summary"] }),
        // CRITICAL: Invalidate the technician's assigned services query
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] }),
      ]);
      
      // Force refetch the assigned services summary and technician's services
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/technicians/assigned-services-summary"] }),
        queryClient.refetchQueries({ queryKey: ["/api/service-requests/technician", technicianId] }),
      ]);
      
      toast({ 
        title: "Assigned", 
        description: `Service assigned to ${name} successfully` 
      });
      
      // Wait a moment before redirecting to allow the assignment to be saved and UI to update
      setTimeout(() => {
        window.location.href = "/service-requests";
      }, 1000);
    } catch (err: any) {
      console.error("Error assigning technician:", err);
      toast({ 
        title: "Error", 
        description: err?.message || "Error assigning technician", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Assign Technician" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Assign Technician</h2>
            <p className="text-sm text-muted-foreground">
              Select a technician to assign this service request. Internal ({filteredInternal.length}) • Third-Party ({filteredThird.length})
            </p>
          </div>

          <div>
            <Input
              placeholder="Search by name or specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-soft"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Internal */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Internal Technicians ({filteredInternal.length})</h3>
                {filteredInternal.map((tech: any) => (
                  <Card key={tech.id || tech._id} className="mb-4 shadow-sm hover:shadow-md transition-all" style={{ background: '#FFFFFF', borderColor: '#FFE0D6' }}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tech.name}</CardTitle>
                        <Badge className="rounded-full" style={{ backgroundColor: '#FFE5B4', color: '#333' }}>Internal</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {tech.specialization || (Array.isArray(tech.skills) ? tech.skills.join(", ") : "general")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{tech.phone || tech.user?.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {typeof tech.baseLocation === "string" ? (tech.baseLocation || "Not set") : (tech.baseLocation?.city || "Not set")}
                        </span>
                      </div>
                      <div className="pt-2">
                        <Button className="btn-primary" onClick={() => handleAssign(tech.id || tech._id, "internal", tech.name)}>
                          Assign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredInternal.length === 0 && (
                  <div className="text-sm text-muted-foreground">No internal technicians found.</div>
                )}
              </div>

              {/* Third-Party */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Third-Party Technicians ({filteredThird.length})</h3>
                {filteredThird.map((tp: any) => (
                  <Card
                    key={tp.id || tp._id}
                    className="mb-4 shadow-sm hover:shadow-md transition-all bg-gradient-to-br from-[#FFF1EC] to-[#FFF9F7]"
                    style={{ borderColor: '#FFE0D6' }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tp.name || tp.contactName}</CardTitle>
                        <Badge className="rounded-full" style={{ backgroundColor: '#FFD4E3', color: '#333' }}>Third-Party</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {tp.specialization || "general"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{tp.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {typeof tp.baseLocation === "string" ? (tp.baseLocation || "Not set") : (tp.baseLocation?.city || "Not set")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">Money Allowance (₹): {tp.moneyAllowance ?? 0}</span>
                      </div>
                      <div className="pt-2">
                        <Button
                          className="btn-secondary"
                          onClick={() => handleAssign(tp.id || tp._id, "thirdparty", tp.name || tp.contactName)}
                        >
                          Assign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredThird.length === 0 && (
                  <div className="text-sm text-muted-foreground">No third-party technicians found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


