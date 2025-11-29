import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Plane,
  MapPin,
  Calendar,
  User,
  FileText,
  Send,
  IndianRupee,
  CheckCircle,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TripFinancePDF } from "./trip-finance-pdf";

interface PlannedTripsListProps {
  onTripSelected?: (tripId: string) => void;
}

export function PlannedTripsList({ onTripSelected }: PlannedTripsListProps) {
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/trips/planned"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/trips/planned");
      return await res.json();
    },
  });

  const trips = data?.trips || [];

  const handleGeneratePDF = (trip: any) => {
    setSelectedTrip(trip);
    setShowPDFPreview(true);
  };

  const handleSendToFinance = async (trip: any) => {
    try {
      const res = await apiRequest("POST", "/api/trips/generate-finance-pdf", {
        tripId: trip.id,
        trip,
        technician: trip.technician,
      });

      if (res.ok) {
        const data = await res.json();
        // Show PDF preview with the generated data
        if (data.pdfData) {
          setSelectedTrip({
            ...trip,
            ...data.pdfData
          });
          setShowPDFPreview(true);
        }
        toast({
          title: "PDF Generated Successfully",
          description: "Finance approval PDF is ready. Preview shown below.",
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading planned trips...</p>
        </CardContent>
      </Card>
    );
  }

  if (trips.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Plane className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium">No Planned Trips</p>
          <p className="text-sm text-muted-foreground">
            Trips that you plan will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Planned Trips ({trips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip: any) => (
                <TableRow key={trip.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {trip.technician?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {trip.technician?.employeeCode || ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {typeof trip.destinationCity === 'object'
                          ? (trip.destinationCity as any).city
                          : trip.destinationCity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {new Date(trip.startDate).toLocaleDateString()} -{" "}
                        {new Date(trip.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {trip.tasks?.length || 0} tasks
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium">
                      <IndianRupee className="h-3 w-3" />
                      <span>
                        {trip.costs?.totalEstimatedCost
                          ? Number(trip.costs.totalEstimatedCost).toLocaleString(
                            "en-IN"
                          )
                          : "0"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        trip.tripStatus === "planned"
                          ? "default"
                          : trip.tripStatus === "completed"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {trip.tripStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGeneratePDF(trip)}
                        className="gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSendToFinance(trip)}
                        className="gap-1"
                      >
                        <Send className="h-3 w-3" />
                        Send
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PDF Preview Dialog */}
      <Dialog open={showPDFPreview} onOpenChange={(open) => {
        setShowPDFPreview(open);
        if (!open) {
          setSelectedTrip(null);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedTrip && (
            <TripFinancePDF
              tripData={selectedTrip.tripData || selectedTrip}
              technician={selectedTrip.technician}
              serviceRequests={selectedTrip.serviceRequests || selectedTrip.tasks?.filter((t: any) => t.taskType !== 'pm') || []}
              pmContainers={selectedTrip.pmContainers || selectedTrip.tasks?.filter((t: any) => t.taskType === 'pm') || []}
              wageBreakdown={selectedTrip.wageBreakdown || selectedTrip.costs || {}}
              generatedAt={selectedTrip.generatedAt || new Date().toISOString()}
              generatedBy={selectedTrip.generatedBy || "System"}
              onClose={() => {
                setShowPDFPreview(false);
                setSelectedTrip(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
