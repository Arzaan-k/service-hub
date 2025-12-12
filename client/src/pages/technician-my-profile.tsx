import { useState, useEffect, useRef } from "react";
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
import { MapPin, Phone, Star, Wrench, Save, Edit, FileText, Upload, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import WageBreakdown from "@/components/wage-breakdown";
import MapMyIndiaAutocomplete from "@/components/map-my-india-autocomplete";
import { useNavigate } from "react-router-dom";

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
          {/* Document Reminder Banner */}
          <DocumentReminderBanner technicianId={technician.id} />
          
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

          {/* Documents Section */}
          <TechnicianDocumentsSection technicianId={technician.id} />
        </div>
      </main>
    </div>
  );
}

// Documents Section Component
function TechnicianDocumentsSection({ technicianId }: { technicianId: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const DOCUMENT_TYPES = [
    { id: 'aadhar', label: 'Aadhar Card', icon: '🪪' },
    { id: 'health_report', label: 'Health Report', icon: '🏥' },
    { id: 'cbc_report', label: 'CBC Report', icon: '🩺' },
    { id: 'insurance_report', label: 'Insurance Report', icon: '🛡️' }
  ];

  // Fetch documents
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["/api/technician/my-documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technician/my-documents");
      const data = await res.json();
      return data.documents || [];
    },
  });

  // Fetch document status
  const { data: status } = useQuery({
    queryKey: ["/api/technician/documents-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technician/documents-status");
      return await res.json();
    },
  });

  const handleFileSelect = async (docType: string, file: File) => {
    if (!file) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Only JPG, PNG, and PDF files are allowed",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);

      const res = await apiRequest("POST", "/api/technician/upload-document", formData);
      const data = await res.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `${DOCUMENT_TYPES.find(d => d.id === docType)?.label} uploaded successfully`,
        });
        refetch();
      } else {
        toast({
          title: "Error",
          description: data.message || "Upload failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Upload failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getDocumentForType = (docType: string) => {
    return documents?.find((doc: any) => doc.documentType === docType);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Upload required documents for your profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status?.isComplete ? "default" : "secondary"}>
              {status?.uploadedCount || 0}/4 Uploaded
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/technician/submit-documents')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {DOCUMENT_TYPES.map((docType) => {
              const doc = getDocumentForType(docType.id);
              return (
                <div
                  key={docType.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    doc ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{docType.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{docType.label}</span>
                        {doc && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                      {doc ? (
                        <p className="text-sm text-muted-foreground">
                          {doc.filename} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doc.fileUrl, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                    <input
                      ref={(el) => (fileInputRefs.current[docType.id] = el)}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileSelect(docType.id, file);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      variant={doc ? "outline" : "default"}
                      size="sm"
                      onClick={() => fileInputRefs.current[docType.id]?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          {doc ? 'Replace' : 'Upload'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Document Reminder Banner Component
function DocumentReminderBanner({ technicianId }: { technicianId: string }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Fetch document status
  const { data: status } = useQuery({
    queryKey: ["/api/technician/documents-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/technician/documents-status");
      return await res.json();
    },
  });

  // Don't show if documents are complete or banner is dismissed
  if (!status || status.isComplete || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="bg-orange-500 rounded-full p-2 mt-1">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 text-lg">
              Action Required: Upload Your Documents
            </h3>
            <p className="text-orange-800 mt-1">
              You have uploaded <strong>{status.uploadedCount}/4</strong> required documents. 
              Please upload the remaining documents to complete your profile.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {status.missingDocuments?.map((docType: string) => (
                <Badge key={docType} variant="outline" className="bg-white border-orange-300 text-orange-700">
                  {docType.replace('_', ' ').toUpperCase()} - Missing
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                size="sm"
                onClick={() => navigate('/technician/submit-documents')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => {
                  const documentsSection = document.getElementById('documents-section');
                  if (documentsSection) {
                    documentsSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                View Below
              </Button>
              <Button 
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="text-orange-700 hover:text-orange-900"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
