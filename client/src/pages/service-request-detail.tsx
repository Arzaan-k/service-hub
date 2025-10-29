import { useParams, Link } from "react-router-dom";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, MapPin, Package, UserCheck, ArrowLeft } from "lucide-react";

export default function ServiceRequestDetail() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/service-requests", id],
    queryFn: async () => (await apiRequest("GET", `/api/service-requests/${id}`)).json(),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Service Request" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Service Request" />
          <div className="p-6">
            <Link to="/service-requests" className="inline-flex items-center gap-2 text-sm text-primary">
              <ArrowLeft className="w-4 h-4" /> Back to list
            </Link>
            <p className="mt-4 text-sm text-red-600">Failed to load service request.</p>
          </div>
        </main>
      </div>
    );
  }

  const req = data as any;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Request" />
        <div className="p-6 space-y-6">
          <Link to="/service-requests" className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="w-4 h-4" /> Back to list
          </Link>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="font-mono">{req.requestNumber}</span>
                <Badge variant="outline">{req.status}</Badge>
                <Badge variant="outline">{req.priority}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Package className="w-4 h-4" /><span className="font-medium">Container:</span><span className="font-mono">{req.container?.containerCode || "-"}</span></div>
                  <div className="flex items-center gap-2"><UserCheck className="w-4 h-4" /><span className="font-medium">Technician:</span><span>{req.technician?.name || "Unassigned"}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /><span className="font-medium">Location:</span><span>{req.container?.currentLocation?.address || "Unknown"}</span></div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span className="font-medium">Scheduled:</span><span>{req.scheduledDate ? new Date(req.scheduledDate).toLocaleString() : "-"}</span></div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span className="font-medium">Started:</span><span>{req.actualStartTime ? new Date(req.actualStartTime).toLocaleString() : "-"}</span></div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span className="font-medium">Completed:</span><span>{req.actualEndTime ? new Date(req.actualEndTime).toLocaleString() : "-"}</span></div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Issue Description</p>
                <p className="text-sm">{req.issueDescription}</p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Before Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {(req.beforePhotos || []).length > 0 ? (
                      req.beforePhotos.map((ref: string, idx: number) => (
                        <a key={`b-${idx}`} className="block w-24 h-24 bg-muted rounded overflow-hidden border" href={`/api/whatsapp/media/${encodeURIComponent(ref)}`} target="_blank" rel="noreferrer">
                          <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(ref)}`} />
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No photos</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">After Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {(req.afterPhotos || []).length > 0 ? (
                      req.afterPhotos.map((ref: string, idx: number) => (
                        <a key={`a-${idx}`} className="block w-24 h-24 bg-muted rounded overflow-hidden border" href={`/api/whatsapp/media/${encodeURIComponent(ref)}`} target="_blank" rel="noreferrer">
                          <img className="w-full h-full object-cover" src={`/api/whatsapp/media/${encodeURIComponent(ref)}`} />
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No photos</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Signed Report</p>
                  {req.resolutionNotes ? (
                    <pre className="text-xs whitespace-pre-wrap bg-muted rounded p-2 border max-h-40 overflow-auto">{req.resolutionNotes}</pre>
                  ) : (
                    <span className="text-xs text-muted-foreground">No report</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}




