import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plane,
  Wrench,
  Target,
  Calculator,
  Clock,
  MapPin,
  IndianRupee,
  CheckCircle,
  AlertTriangle,
  Info
} from "lucide-react";

interface ServiceRequest {
  id: string;
  requestNumber: string;
  status: string;
  priority: string;
  issueDescription: string;
  scheduledDate?: string;
  containerCode?: string;
  customerName?: string;
  estimatedCost?: number;
}

interface PMTask {
  id: string;
  containerCode: string;
  customerId?: string;
  customerName?: string;
  pmStatus: 'OVERDUE' | 'NEVER' | 'DUE_SOON' | 'UP_TO_DATE';
  daysSincePm: number | null;
}

interface Technician {
  id: string;
  name: string;
  employeeCode: string;
  baseLocation: string;
  grade?: string;
  designation?: string;
  hotelAllowance?: number;
  localTravelAllowance?: number;
}

interface ConsolidatedTripCardProps {
  technician: Technician;
  city: string;
  assignedServices: ServiceRequest[];
  pmTasks: PMTask[];
  onPlanTrip: (params: {
    technicianId: string;
    destinationCity: string;
    startDate: string;
    endDate: string;
    selectedServices?: string[];
    selectedPMTasks?: string[];
  }) => void;
  onTripPlanned?: (tripData: any) => void;
}

export function ConsolidatedTripCard({
  technician,
  city,
  assignedServices,
  pmTasks,
  onPlanTrip
}: ConsolidatedTripCardProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>(
    assignedServices.map(s => s.id)
  );
  const [selectedPMTasks, setSelectedPMTasks] = useState<string[]>(
    pmTasks.filter(pm => pm.pmStatus === 'OVERDUE' || pm.pmStatus === 'NEVER').map(pm => pm.id)
  );
  const [miscellaneousCost, setMiscellaneousCost] = useState<number>(0);

  // Cost calculations using actual DB values
  const costBreakdown = useMemo(() => {
    const serviceCount = selectedServices.length;
    const pmCount = selectedPMTasks.length;
    const totalTasks = serviceCount + pmCount;

    // Use actual costs from technician profile (NO hardcoded defaults)
    const serviceCost = technician.serviceRequestCost || 0;
    const pmCost = technician.pmCost || 0;
    const hotelAllowance = technician.hotelAllowance || 0;
    const localTravelAllowance = technician.localTravelAllowance || 0;
    const dailyAllowance = hotelAllowance + localTravelAllowance;

    // Check if cost values are missing from DB
    const hasMissingCosts = !serviceCost || !pmCost || !dailyAllowance;

    // Calculate costs using technician's tasksPerDay rate from DB
    const tasksPerDay = technician.tasksPerDay || 3; // Use DB rate, default to 3 if not set
    const serviceCosts = serviceCount * serviceCost;
    const pmCosts = pmCount * pmCost;
    const estimatedDays = Math.max(1, Math.ceil(totalTasks / tasksPerDay));
    const travelAllowance = estimatedDays * dailyAllowance;

    // Additional costs
    const miscellaneous = miscellaneousCost || 0;
    const contingency = Math.round((serviceCosts + pmCosts) * 0.03); // 3% contingency

    const subtotal = serviceCosts + pmCosts;
    const totalAdditional = travelAllowance + miscellaneous + contingency;
    const total = subtotal + totalAdditional;

    return {
      serviceCosts,
      pmCosts,
      travelAllowance,
      miscellaneous,
      contingency,
      subtotal,
      totalAdditional,
      total,
      estimatedDays,
      breakdown: {
        serviceRate: serviceCost,
        pmRate: pmCost,
        dailyAllowance,
        serviceCount,
        pmCount
      }
    };
  }, [selectedServices, selectedPMTasks, technician, miscellaneousCost]);

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handlePMToggle = (pmId: string) => {
    setSelectedPMTasks(prev =>
      prev.includes(pmId)
        ? prev.filter(id => id !== pmId)
        : [...prev, pmId]
    );
  };

  const handlePlanTrip = () => {
    onPlanTrip({
      technicianId: technician.id,
      destinationCity: city,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      selectedServices,
      selectedPMTasks
    });
  };

  const totalTasks = selectedServices.length + selectedPMTasks.length;
  const hasUrgentWork = pmTasks.some(pm => pm.pmStatus === 'OVERDUE') ||
                       assignedServices.some(s => s.priority?.toLowerCase() === 'high' || s.priority?.toLowerCase() === 'urgent');

  // Extract city name from "City (Client Name)" format
  const cityMatch = city.match(/^(.+?)\s*\(/);
  const cityName = cityMatch ? cityMatch[1].trim() : city;

  return (
    <Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-blue-600/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Trip to {cityName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {technician.name} ({technician.employeeCode})
              </p>
            </div>
          </div>
          {hasUrgentWork && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Urgent Work
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Service Requests Section */}
        {assignedServices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-orange-500" />
              <h4 className="font-medium">Assigned Service Requests ({assignedServices.length})</h4>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {assignedServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedServices.includes(service.id)}
                    onCheckedChange={() => handleServiceToggle(service.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{service.requestNumber}</span>
                      <Badge variant={
                        service.priority?.toLowerCase() === 'high' || service.priority?.toLowerCase() === 'urgent'
                          ? 'destructive'
                          : service.priority?.toLowerCase() === 'medium'
                          ? 'default'
                          : 'secondary'
                      } className="text-xs">
                        {service.priority || 'Normal'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {service.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {service.containerCode} • {service.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {service.issueDescription}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">₹{costBreakdown.breakdown.serviceRate.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">est.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PM Tasks Section */}
        {pmTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-red-500" />
              <h4 className="font-medium">PM Tasks ({pmTasks.length})</h4>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pmTasks.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedPMTasks.includes(pm.id)}
                    onCheckedChange={() => handlePMToggle(pm.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{pm.containerCode}</span>
                      <Badge
                        variant={
                          pm.pmStatus === 'OVERDUE' ? 'destructive' :
                          pm.pmStatus === 'NEVER' ? 'destructive' :
                          pm.pmStatus === 'DUE_SOON' ? 'secondary' : 'outline'
                        }
                        className="text-xs"
                      >
                        {pm.pmStatus === 'OVERDUE' ? 'Overdue' :
                         pm.pmStatus === 'NEVER' ? 'Never Done' :
                         pm.pmStatus === 'DUE_SOON' ? 'Due Soon' : 'Up to Date'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pm.customerName || 'Unknown Customer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pm.daysSincePm ? `${pm.daysSincePm} days since last PM` : 'Never had PM'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">₹{costBreakdown.breakdown.pmRate.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">est.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-green-600" />
            <h4 className="font-medium">Cost Breakdown</h4>
            {(!technician.serviceRequestCost || !technician.pmCost || !dailyAllowance) && (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Cost values not set in technician profile
              </Badge>
            )}
          </div>

          <div className="space-y-3 text-sm">
            {/* Task Costs */}
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Task Costs</h5>
              <div className="space-y-1 pl-2">
                <div className="flex justify-between">
                  <span>Service Requests ({costBreakdown.breakdown.serviceCount} × ₹{costBreakdown.breakdown.serviceRate.toLocaleString()})</span>
                  <span className="font-medium">₹{costBreakdown.serviceCosts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>PM Tasks ({costBreakdown.breakdown.pmCount} × ₹{costBreakdown.breakdown.pmRate.toLocaleString()})</span>
                  <span className="font-medium">₹{costBreakdown.pmCosts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium text-blue-600">
                  <span>Subtotal</span>
                  <span>₹{costBreakdown.subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Travel Allowance */}
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Travel Allowance</h5>
              <div className="space-y-1 pl-2">
                <div className="flex justify-between">
                  <span>Hotel Allowance (₹{technician.hotelAllowance || 0} × {costBreakdown.estimatedDays} days)</span>
                  <span className="font-medium">₹{((technician.hotelAllowance || 0) * costBreakdown.estimatedDays).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Local Travel (₹{technician.localTravelAllowance || 0} × {costBreakdown.estimatedDays} days)</span>
                  <span className="font-medium">₹{((technician.localTravelAllowance || 0) * costBreakdown.estimatedDays).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium text-purple-600">
                  <span>Total Travel Allowance</span>
                  <span>₹{costBreakdown.travelAllowance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Additional Costs */}
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Additional Costs</h5>
              <div className="space-y-2 pl-2">
                <div className="flex items-center justify-between">
                  <span>Miscellaneous</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">₹</span>
                    <Input
                      type="number"
                      value={miscellaneousCost}
                      onChange={(e) => setMiscellaneousCost(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 h-7 text-xs"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Contingency (3% of task costs)</span>
                  <span className="font-medium">₹{costBreakdown.contingency.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium text-orange-600">
                  <span>Total Additional</span>
                  <span>₹{costBreakdown.totalAdditional.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between text-base font-bold">
              <span>Total Estimated Cost</span>
              <span className="text-green-600">₹{costBreakdown.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Trip Planning */}
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {totalTasks} tasks selected • Estimated {Math.ceil(totalTasks / 3)} days
                </span>
                <Button
                  onClick={handlePlanTrip}
                  className="gap-2"
                  disabled={totalTasks === 0}
                >
                  <Plane className="h-4 w-4" />
                  Plan Consolidated Trip
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This will create a trip plan that includes both selected service requests and PM tasks,
                optimizing the route and scheduling for maximum efficiency.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
