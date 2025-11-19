/**
 * CONTAINER SERVICE HISTORY COMPONENT
 *
 * Shows complete service history for a specific container
 * Maps all historical services by container number
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  User,
  Wrench,
  FileText,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Package,
  Clock,
  Activity
} from "lucide-react";
import { format, formatDistance } from "date-fns";
import { useState } from "react";
import ServiceHistoryDetailed from "./ServiceHistoryDetailed";
import { getAuthToken } from "@/lib/auth";

interface Props {
  containerNumber: string;
  compact?: boolean; // For embedding in other pages
}

export function ContainerServiceHistory({ containerNumber, compact = false }: Props) {
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch service history for this container
  const { data: serviceHistory, isLoading, error } = useQuery({
    queryKey: ['/api/service-history/container', containerNumber],
    queryFn: async () => {
      const token = getAuthToken();
      console.log('[ContainerServiceHistory] Fetching service history for container:', containerNumber);
      const res = await fetch(`/api/service-history/container/${containerNumber}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token || ''
        }
      });
      console.log('[ContainerServiceHistory] Response status:', res.status);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied to this container\'s service history');
        }
        const errorText = await res.text();
        console.error('[ContainerServiceHistory] Error response:', errorText);
        throw new Error('Failed to fetch service history');
      }
      const data = await res.json();
      console.log('[ContainerServiceHistory] Data received:', data?.length || 0, 'records');
      return data;
    },
    enabled: !!containerNumber
  });

  // Fetch timeline data
  const { data: timeline } = useQuery({
    queryKey: ['/api/service-history/container', containerNumber, 'timeline'],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/service-history/container/${containerNumber}/timeline`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token || ''
        }
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied to this container\'s timeline');
        }
        throw new Error('Failed to fetch timeline');
      }
      return res.json();
    },
    enabled: !!containerNumber
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading service history...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            {error.message || 'You do not have permission to view this container\'s service history'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!serviceHistory || serviceHistory.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Service History</h3>
          <p className="text-muted-foreground">
            No historical service records found for container {containerNumber}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleViewDetails = (service: any) => {
    setSelectedService(service);
    setShowDetailsDialog(true);
  };

  // Calculate statistics
  const stats = {
    totalServices: serviceHistory.length,
    lastService: serviceHistory[0]?.complaintAttendedDate,
    firstService: serviceHistory[serviceHistory.length - 1]?.complaintAttendedDate,
    foc: serviceHistory.filter((s: any) => s.jobType === 'FOC').length,
    paid: serviceHistory.filter((s: any) => s.jobType !== 'FOC').length,
    technicians: [...new Set(serviceHistory.map((s: any) => s.technicianName).filter(Boolean))].length,
    commonIssues: getTopIssues(serviceHistory)
  };

  if (compact) {
    return (
      <div className="space-y-4">
        <CompactStats stats={stats} containerNumber={containerNumber} />
        <CompactTimeline services={serviceHistory.slice(0, 5)} onViewDetails={handleViewDetails} />

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Service Details</DialogTitle>
              <DialogDescription>
                Complete service history for {containerNumber}
              </DialogDescription>
            </DialogHeader>
            {selectedService && <ServiceHistoryDetailed serviceHistory={selectedService} />}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">
                Service History: {containerNumber}
              </CardTitle>
              <CardDescription className="mt-2">
                Complete maintenance and service records
              </CardDescription>
            </div>
            <Badge className="text-lg px-4 py-2">
              {stats.totalServices} Services
            </Badge>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <StatCard
              icon={<Calendar className="h-5 w-5 text-blue-600" />}
              label="Last Service"
              value={stats.lastService ? format(new Date(stats.lastService), 'MMM dd, yyyy') : 'N/A'}
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-green-600" />}
              label="Time Span"
              value={
                stats.firstService && stats.lastService
                  ? formatDistance(new Date(stats.firstService), new Date(stats.lastService))
                  : 'N/A'
              }
            />
            <StatCard
              icon={<User className="h-5 w-5 text-purple-600" />}
              label="Technicians"
              value={`${stats.technicians} different`}
            />
            <StatCard
              icon={<Activity className="h-5 w-5 text-orange-600" />}
              label="Service Type"
              value={`${stats.foc} FOC / ${stats.paid} Paid`}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Common Issues Alert */}
      {stats.commonIssues.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <AlertCircle className="h-5 w-5" />
              Common Issues Identified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.commonIssues.map((issue, index) => (
                <Badge key={index} variant="outline" className="text-sm">
                  {issue.issue} ({issue.count}x)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Service List</TabsTrigger>
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Service List Tab */}
        <TabsContent value="list" className="space-y-3">
          {serviceHistory.map((service: any) => (
            <ServiceCard
              key={service.id}
              service={service}
              onViewDetails={() => handleViewDetails(service)}
            />
          ))}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Service Timeline</CardTitle>
              <CardDescription>
                Chronological view of all service events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerticalTimeline
                services={timeline || serviceHistory}
                onViewDetails={handleViewDetails}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AnalyticsView
            services={serviceHistory}
            stats={stats}
          />
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Service Details</DialogTitle>
            <DialogDescription>
              Full service history record with all inspection data
            </DialogDescription>
          </DialogHeader>
          {selectedService && <ServiceHistoryDetailed serviceHistory={selectedService} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  onViewDetails
}: {
  service: any;
  onViewDetails: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{service.jobOrderNumber}</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(service.complaintAttendedDate), 'MMMM dd, yyyy')}
            </p>
          </div>
          <Badge variant={service.jobType === 'FOC' ? 'secondary' : 'default'}>
            {service.jobType}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 mb-4">
          <div className="flex items-start gap-2 text-sm">
            <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Work Type</p>
              <p className="font-medium">{service.workType || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Technician</p>
              <p className="font-medium">{service.technicianName || 'N/A'}</p>
            </div>
          </div>
        </div>

        {service.issuesFound && (
          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-md border border-orange-200 dark:border-orange-800">
            <p className="text-xs font-medium text-orange-900 dark:text-orange-100 mb-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Issues Found:
            </p>
            <p className="text-sm text-orange-800 dark:text-orange-200 line-clamp-2">
              {service.issuesFound}
            </p>
          </div>
        )}

        {service.workDescription && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Work Done:
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 line-clamp-2">
              {service.workDescription}
            </p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onViewDetails}
        >
          View Complete Details
        </Button>
      </CardContent>
    </Card>
  );
}

function VerticalTimeline({
  services,
  onViewDetails
}: {
  services: any[];
  onViewDetails: (service: any) => void;
}) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

      {/* Timeline events */}
      <div className="space-y-6">
        {services.map((service, index) => (
          <div key={service.jobOrderNumber || index} className="relative flex gap-4">
            {/* Icon */}
            <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white">
              <Wrench className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">{service.jobOrderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(service.complaintAttendedDate), 'PPpp')}
                  </p>
                </div>
                <Badge variant={service.jobType === 'FOC' ? 'secondary' : 'default'} className="ml-2">
                  {service.jobType}
                </Badge>
              </div>

              {service.workType && (
                <p className="text-sm mb-1">
                  <span className="text-muted-foreground">Type:</span> {service.workType}
                </p>
              )}

              {service.technicianName && (
                <p className="text-sm mb-2">
                  <span className="text-muted-foreground">Tech:</span> {service.technicianName}
                </p>
              )}

              {service.issuesFound && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {service.issuesFound}
                </p>
              )}

              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto"
                onClick={() => onViewDetails(service)}
              >
                View Details →
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView({
  services,
  stats
}: {
  services: any[];
  stats: any;
}) {
  const monthlyData = getMonthlyServiceCount(services);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Service Frequency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {monthlyData.slice(0, 6).map((month: any) => (
              <div key={month.month} className="flex items-center justify-between">
                <span className="text-sm">{month.month}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(month.count / Math.max(...monthlyData.map((m: any) => m.count))) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{month.count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <span className="text-sm font-medium">FOC Services</span>
            <span className="text-2xl font-bold text-blue-600">{stats.foc}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <span className="text-sm font-medium">Paid Services</span>
            <span className="text-2xl font-bold text-green-600">{stats.paid}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <span className="text-sm font-medium">Total Services</span>
            <span className="text-2xl font-bold text-purple-600">{stats.totalServices}</span>
          </div>
        </CardContent>
      </Card>

      {stats.commonIssues.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recurring Issues</CardTitle>
            <CardDescription>Most frequent problems for this container</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.commonIssues.map((issue: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="text-sm">{issue.issue}</span>
                  </div>
                  <Badge>{issue.count}x</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompactStats({ stats, containerNumber }: { stats: any; containerNumber: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Services</p>
          <p className="text-2xl font-bold text-blue-600">{stats.totalServices}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Last Service</p>
          <p className="text-sm font-semibold">
            {stats.lastService ? format(new Date(stats.lastService), 'MMM dd') : 'N/A'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Technicians</p>
          <p className="text-2xl font-bold text-purple-600">{stats.technicians}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">FOC/Paid</p>
          <p className="text-sm font-semibold">{stats.foc}/{stats.paid}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CompactTimeline({
  services,
  onViewDetails
}: {
  services: any[];
  onViewDetails: (service: any) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Services</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service: any) => (
            <div
              key={service.id}
              className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer"
              onClick={() => onViewDetails(service)}
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{service.jobOrderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(service.complaintAttendedDate), 'MMM dd, yyyy')} • {service.technicianName || 'N/A'}
                </p>
              </div>
              <Badge variant={service.jobType === 'FOC' ? 'secondary' : 'default'} className="text-xs">
                {service.jobType}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getTopIssues(services: any[]): Array<{ issue: string; count: number }> {
  const issueMap = new Map<string, number>();

  services.forEach(service => {
    if (service.issuesFound) {
      const issue = service.issuesFound.trim().substring(0, 50);
      issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
    }
  });

  return Array.from(issueMap.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function getMonthlyServiceCount(services: any[]): Array<{ month: string; count: number }> {
  const monthMap = new Map<string, number>();

  services.forEach(service => {
    if (service.complaintAttendedDate) {
      const month = format(new Date(service.complaintAttendedDate), 'MMM yyyy');
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }
  });

  return Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateB.getTime() - dateA.getTime();
    });
}

export default ContainerServiceHistory;
