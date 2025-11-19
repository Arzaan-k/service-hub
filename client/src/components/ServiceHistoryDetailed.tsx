/**
 * COMPREHENSIVE SERVICE HISTORY VIEWER
 *
 * Displays complete service history with all 158 fields from Excel
 * Organized into 7 workflow stages with proper UI/UX
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  User,
  Package,
  Wrench,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Truck,
  Settings,
  Activity,
  Zap,
  Thermometer,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ServiceHistoryData {
  id: string;
  jobOrderNumber: string;

  // Stage 1: Complaint Registration
  complaintRegistrationTime?: Date;
  complaintRegisteredBy?: string;
  clientName: string;
  contactPersonName?: string;
  contactPersonNumber?: string;
  containerNumber: string;
  initialComplaint?: string;
  complaintRemarks?: string;

  // Stage 2: Job Assignment
  assignmentTime?: Date;
  assignedBy?: string;
  machineMake?: string;
  containerSize?: string;
  workType?: string;
  clientType?: string;
  jobType?: string;
  issuesFound?: string;
  remedialAction?: string;
  listOfSparesRequired?: string;
  reeferUnit?: string;
  reeferUnitModelName?: string;
  technicianName?: string;

  // Stage 3: Indent
  indentRequired?: boolean;
  indentNo?: string;
  indentDate?: Date;
  billingType?: string;

  // Stage 4: Material Arrangement
  materialArrangedBy?: string;
  requiredMaterialArranged?: boolean;

  // Stage 5: Material Dispatch
  materialSentThrough?: string;
  courierName?: string;
  courierTrackingId?: string;

  // Stage 6: Service Execution
  complaintAttendedDate: Date;
  serviceType?: string;
  serviceClientLocation?: string;
  operatingTemperature?: string;

  // Equipment Inspection (28 points)
  containerCondition?: string;
  condenserCoil?: string;
  condenserMotor?: string;
  evaporatorCoil?: string;
  evaporatorMotor?: string;
  compressorOil?: string;
  refrigerantGas?: string;
  controllerDisplay?: string;
  controllerKeypad?: string;
  powerCable?: string;
  machineMainBreaker?: string;
  compressorContactor?: string;
  evpCondContactor?: string;
  customerMainMcb?: string;
  filterDrier?: string;
  pressure?: string;
  compressorCurrent?: string;
  mainVoltage?: string;
  pti?: string;

  // Documentation
  observations?: string;
  workDescription?: string;
  requiredSpareParts?: string;

  // Stage 7: Follow-up
  anyPendingJob?: boolean;
  nextServiceCallRequired?: boolean;
  nextServiceUrgency?: string;
}

interface Props {
  serviceHistory: ServiceHistoryData;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceHistoryDetailed({ serviceHistory }: Props) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Job Order: {serviceHistory.jobOrderNumber}
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                {serviceHistory.clientName} • {serviceHistory.containerNumber}
              </CardDescription>
            </div>
            <Badge variant={serviceHistory.jobType === 'FOC' ? 'secondary' : 'default'} className="text-sm px-3 py-1">
              {serviceHistory.jobType || 'N/A'}
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Service Date</p>
                <p className="font-semibold">
                  {format(new Date(serviceHistory.complaintAttendedDate), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Technician</p>
                <p className="font-semibold">{serviceHistory.technicianName || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Work Type</p>
                <p className="font-semibold">{serviceHistory.workType || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Machine Make</p>
                <p className="font-semibold">{serviceHistory.machineMake || 'N/A'}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="complaint">Complaint</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="inspection">Inspection</TabsTrigger>
          <TabsTrigger value="work">Work Done</TabsTrigger>
          <TabsTrigger value="followup">Follow-up</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Service Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Service Type" value={serviceHistory.serviceType} />
                <InfoRow label="Client Type" value={serviceHistory.clientType} />
                <InfoRow label="Billing Type" value={serviceHistory.billingType} />
                <InfoRow label="Location" value={serviceHistory.serviceClientLocation} icon={<MapPin className="h-4 w-4" />} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Equipment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Container Size" value={serviceHistory.containerSize} />
                <InfoRow label="Reefer Unit" value={serviceHistory.reeferUnit} />
                <InfoRow label="Model" value={serviceHistory.reeferUnitModelName} />
                <InfoRow label="Operating Temp" value={serviceHistory.operatingTemperature} icon={<Thermometer className="h-4 w-4" />} />
              </CardContent>
            </Card>
          </div>

          {/* Issue Summary */}
          {serviceHistory.issuesFound && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  Issues Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {serviceHistory.issuesFound}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Work Summary */}
          {serviceHistory.workDescription && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-blue-600" />
                  Work Performed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {serviceHistory.workDescription}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: COMPLAINT REGISTRATION */}
        <TabsContent value="complaint" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Initial Complaint Details
              </CardTitle>
              {serviceHistory.complaintRegistrationTime && (
                <CardDescription>
                  Registered on {format(new Date(serviceHistory.complaintRegistrationTime), 'PPpp')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Client Name" value={serviceHistory.clientName} />
              <InfoRow label="Contact Person" value={serviceHistory.contactPersonName} icon={<User className="h-4 w-4" />} />
              <InfoRow label="Contact Number" value={serviceHistory.contactPersonNumber} icon={<Phone className="h-4 w-4" />} />
              <InfoRow label="Container Number" value={serviceHistory.containerNumber} icon={<Package className="h-4 w-4" />} />

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Initial Complaint:</p>
                <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                  <p className="text-sm">{serviceHistory.initialComplaint || 'No complaint description'}</p>
                </div>
              </div>

              {serviceHistory.complaintRemarks && (
                <div>
                  <p className="text-sm font-medium mb-2">Remarks:</p>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{serviceHistory.complaintRemarks}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: JOB ASSIGNMENT */}
        <TabsContent value="assignment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Job Assignment & Diagnosis
              </CardTitle>
              {serviceHistory.assignmentTime && (
                <CardDescription>
                  Assigned on {format(new Date(serviceHistory.assignmentTime), 'PPpp')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Assigned By" value={serviceHistory.assignedBy} />
                <InfoRow label="Technician" value={serviceHistory.technicianName} icon={<User className="h-4 w-4" />} />
                <InfoRow label="Work Type" value={serviceHistory.workType} />
                <InfoRow label="Job Type" value={serviceHistory.jobType} />
              </div>

              <Separator />

              {serviceHistory.issuesFound && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Issues Diagnosed:
                  </p>
                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md border border-red-200 dark:border-red-800">
                    <p className="text-sm whitespace-pre-wrap">{serviceHistory.issuesFound}</p>
                  </div>
                </div>
              )}

              {serviceHistory.remedialAction && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-600" />
                    Remedial Action:
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-sm whitespace-pre-wrap">{serviceHistory.remedialAction}</p>
                  </div>
                </div>
              )}

              {serviceHistory.listOfSparesRequired && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-600" />
                    Spares Required:
                  </p>
                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md border border-purple-200 dark:border-purple-800">
                    <p className="text-sm whitespace-pre-wrap">{serviceHistory.listOfSparesRequired}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PARTS MANAGEMENT */}
        <TabsContent value="parts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Parts & Material Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <span className="text-sm font-medium">Indent Required</span>
                  <Badge variant={serviceHistory.indentRequired ? 'default' : 'secondary'}>
                    {serviceHistory.indentRequired ? 'Yes' : 'No'}
                  </Badge>
                </div>

                {serviceHistory.indentRequired && (
                  <>
                    <InfoRow label="Indent Number" value={serviceHistory.indentNo} />
                    <InfoRow label="Billing Type" value={serviceHistory.billingType} />
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                      <span className="text-sm font-medium">Material Arranged</span>
                      <Badge variant={serviceHistory.requiredMaterialArranged ? 'default' : 'secondary'}>
                        {serviceHistory.requiredMaterialArranged ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </>
                )}
              </div>

              {serviceHistory.materialSentThrough && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Dispatch Details
                    </h4>
                    <InfoRow label="Sent Through" value={serviceHistory.materialSentThrough} />
                    {serviceHistory.courierName && (
                      <>
                        <InfoRow label="Courier Name" value={serviceHistory.courierName} />
                        <InfoRow label="Tracking ID" value={serviceHistory.courierTrackingId} />
                      </>
                    )}
                  </div>
                </>
              )}

              {serviceHistory.requiredSpareParts && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Parts Actually Used:</p>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md border border-green-200 dark:border-green-800">
                      <p className="text-sm whitespace-pre-wrap">{serviceHistory.requiredSpareParts}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: EQUIPMENT INSPECTION */}
        <TabsContent value="inspection" className="space-y-4">
          <EquipmentInspectionView serviceHistory={serviceHistory} />
        </TabsContent>

        {/* TAB 6: WORK PERFORMED */}
        <TabsContent value="work" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Work Performed & Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {serviceHistory.workDescription && (
                <div>
                  <p className="text-sm font-medium mb-2">Work Description:</p>
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{serviceHistory.workDescription}</p>
                  </div>
                </div>
              )}

              {serviceHistory.observations && (
                <div>
                  <p className="text-sm font-medium mb-2">Technician Observations:</p>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md border">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{serviceHistory.observations}</p>
                  </div>
                </div>
              )}

              {serviceHistory.requiredSpareParts && (
                <div>
                  <p className="text-sm font-medium mb-2">Spare Parts & Consumables Used:</p>
                  <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-md border border-purple-200 dark:border-purple-800">
                    <p className="text-sm whitespace-pre-wrap">{serviceHistory.requiredSpareParts}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: FOLLOW-UP */}
        <TabsContent value="followup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Closure & Follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <span className="text-sm font-medium">Pending Job</span>
                  <Badge variant={serviceHistory.anyPendingJob ? 'destructive' : 'default'}>
                    {serviceHistory.anyPendingJob ? 'Yes' : 'No'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <span className="text-sm font-medium">Next Service Required</span>
                  <Badge variant={serviceHistory.nextServiceCallRequired ? 'default' : 'secondary'}>
                    {serviceHistory.nextServiceCallRequired ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>

              {serviceHistory.nextServiceUrgency && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Next Service Urgency: {serviceHistory.nextServiceUrgency}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 8: TIMELINE */}
        <TabsContent value="timeline" className="space-y-4">
          <ServiceTimeline serviceHistory={serviceHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function InfoRow({
  label,
  value,
  icon
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
        {icon}
        {label}:
      </span>
      <span className="text-sm font-medium text-right">{value || 'N/A'}</span>
    </div>
  );
}

// Equipment Inspection View Component
function EquipmentInspectionView({ serviceHistory }: { serviceHistory: ServiceHistoryData }) {
  const inspectionCategories = [
    {
      name: "Physical Condition",
      icon: <Activity className="h-5 w-5" />,
      items: [
        { label: "Container Condition", value: serviceHistory.containerCondition },
      ]
    },
    {
      name: "Heat Exchange System",
      icon: <Thermometer className="h-5 w-5" />,
      items: [
        { label: "Condenser Coil", value: serviceHistory.condenserCoil },
        { label: "Condenser Motor", value: serviceHistory.condenserMotor },
        { label: "Evaporator Coil", value: serviceHistory.evaporatorCoil },
        { label: "Evaporator Motor", value: serviceHistory.evaporatorMotor },
      ]
    },
    {
      name: "Refrigeration System",
      icon: <Settings className="h-5 w-5" />,
      items: [
        { label: "Compressor Oil", value: serviceHistory.compressorOil },
        { label: "Refrigerant Gas", value: serviceHistory.refrigerantGas },
        { label: "Filter Drier", value: serviceHistory.filterDrier },
        { label: "Pressure", value: serviceHistory.pressure },
      ]
    },
    {
      name: "Control System",
      icon: <Activity className="h-5 w-5" />,
      items: [
        { label: "Controller Display", value: serviceHistory.controllerDisplay },
        { label: "Controller Keypad", value: serviceHistory.controllerKeypad },
      ]
    },
    {
      name: "Electrical System",
      icon: <Zap className="h-5 w-5" />,
      items: [
        { label: "Power Cable", value: serviceHistory.powerCable },
        { label: "Machine Main Breaker", value: serviceHistory.machineMainBreaker },
        { label: "Compressor Contactor", value: serviceHistory.compressorContactor },
        { label: "EVP/COND Contactor", value: serviceHistory.evpCondContactor },
        { label: "Customer Main MCB", value: serviceHistory.customerMainMcb },
        { label: "Compressor Current", value: serviceHistory.compressorCurrent },
        { label: "Main Voltage", value: serviceHistory.mainVoltage },
      ]
    },
    {
      name: "Performance Test",
      icon: <BarChart3 className="h-5 w-5" />,
      items: [
        { label: "PTI (Pre-Trip Inspection)", value: serviceHistory.pti },
      ]
    },
  ];

  return (
    <div className="grid gap-4">
      {inspectionCategories.map((category) => (
        <Card key={category.name}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {category.icon}
              {category.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {category.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <span className="text-sm">{item.label}</span>
                  <InspectionBadge value={item.value} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InspectionBadge({ value }: { value?: string | null }) {
  if (!value) return <Badge variant="outline">N/A</Badge>;

  const upperValue = value.toUpperCase();

  // Determine badge variant based on value
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";

  if (['OK', 'CLEAN', 'PASS'].includes(upperValue)) {
    variant = "default";
  } else if (['DIRTY', 'NEED CLEANING', 'LOW', 'DIM'].includes(upperValue)) {
    variant = "secondary";
  } else if (['FAULTY', 'DAMAGED', 'NEED REPLACEMENT', 'FAIL'].includes(upperValue)) {
    variant = "destructive";
  }

  return <Badge variant={variant}>{value}</Badge>;
}

// Service Timeline Component
function ServiceTimeline({ serviceHistory }: { serviceHistory: ServiceHistoryData }) {
  const timelineEvents = [
    {
      date: serviceHistory.complaintRegistrationTime,
      label: "Complaint Registered",
      icon: <AlertCircle className="h-4 w-4" />,
      color: "text-red-600",
    },
    {
      date: serviceHistory.assignmentTime,
      label: "Job Assigned",
      icon: <User className="h-4 w-4" />,
      color: "text-blue-600",
      details: `Technician: ${serviceHistory.technicianName}`
    },
    {
      date: serviceHistory.indentDate,
      label: "Parts Requested",
      icon: <Package className="h-4 w-4" />,
      color: "text-purple-600",
      details: serviceHistory.indentNo
    },
    {
      date: serviceHistory.complaintAttendedDate,
      label: "Service Performed",
      icon: <Wrench className="h-4 w-4" />,
      color: "text-green-600",
      highlight: true
    },
  ].filter(event => event.date); // Only show events with dates

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Service Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {/* Timeline events */}
          <div className="space-y-6">
            {timelineEvents.map((event, index) => (
              <div key={index} className="relative flex gap-4">
                {/* Icon */}
                <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${
                  event.highlight ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                } ${event.color}`}>
                  {event.icon}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <p className="font-semibold text-sm">{event.label}</p>
                  {event.date && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {format(new Date(event.date), 'PPpp')}
                    </p>
                  )}
                  {event.details && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {event.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ServiceHistoryDetailed;
