import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, X, ChevronLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServiceHistoryRecord {
  id: string;
  job_order_number?: string;
  container_number: string;
  client_name?: string;
  complaint_attended_date: string;
  service_type?: string;
  technician_name?: string;
  work_type?: string;
  job_type?: string;
  billing_type?: string;
  status: string;
  work_description: string;
  issue_description: string;
  call_status: string;
  required_spare_parts?: string;
  observations?: string;
}

interface ContainerRepairData {
  containerId: string;
  totalRepairs: number;
  lastRepairDate: string;
  daysSinceLast: number;
  uniqueDefects: number;
  mtbfDays: number;
}

export default function FrequentlyRepairedContainers() {
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);

  const { data: serviceHistory, isLoading } = useQuery<ServiceHistoryRecord[]>({
    queryKey: ["/api/service-history"],
  });

  // Process service history to identify frequently repaired containers
  const containerRepairData = useMemo<ContainerRepairData[]>(() => {
    if (!serviceHistory) return [];

    // Group by container_number
    const containerMap = new Map<string, ServiceHistoryRecord[]>();

    serviceHistory.forEach((record) => {
      // Skip records without container number or incomplete/canceled records
      if (!record.container_number) return;
      
      // Filter out incomplete or canceled records
      const status = (record.status || '').toLowerCase();
      const callStatus = (record.call_status || '').toLowerCase();
      
      if (
        status.includes('cancel') ||
        status.includes('incomplete') ||
        callStatus.includes('cancel') ||
        callStatus.includes('incomplete')
      ) {
        return;
      }

      if (!containerMap.has(record.container_number)) {
        containerMap.set(record.container_number, []);
      }
      containerMap.get(record.container_number)!.push(record);
    });

    // Calculate metrics for each container
    const repairDataList: ContainerRepairData[] = [];

    containerMap.forEach((records, containerId) => {
      // Sort by date (most recent first)
      const sortedRecords = records
        .filter((r) => r.complaint_attended_date)
        .sort((a, b) => {
          const dateA = new Date(a.complaint_attended_date).getTime();
          const dateB = new Date(b.complaint_attended_date).getTime();
          return dateB - dateA;
        });

      if (sortedRecords.length === 0) return;

      const totalRepairs = sortedRecords.length;
      const lastRepairDate = sortedRecords[0].complaint_attended_date;

      // Calculate days since last repair
      const lastDate = new Date(lastRepairDate);
      const now = new Date();
      const daysSinceLast = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate unique defects based on work_description and issue_description
      const defectSet = new Set<string>();
      sortedRecords.forEach((record) => {
        const description =
          (record.work_description || '') +
          ' ' +
          (record.issue_description || '');
        if (description.trim()) {
          // Normalize and add to set
          defectSet.add(description.toLowerCase().trim());
        }
      });
      const uniqueDefects = defectSet.size;

      // Calculate MTBF (Mean Time Between Failures) in days
      let mtbfDays = 0;
      if (sortedRecords.length >= 2) {
        const firstDate = new Date(
          sortedRecords[sortedRecords.length - 1].complaint_attended_date
        );
        const lastDateCalc = new Date(sortedRecords[0].complaint_attended_date);
        const totalDays = Math.floor(
          (lastDateCalc.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        mtbfDays = Math.floor(totalDays / (sortedRecords.length - 1));
      }

      repairDataList.push({
        containerId,
        totalRepairs,
        lastRepairDate,
        daysSinceLast,
        uniqueDefects,
        mtbfDays,
      });
    });

    // Sort by totalRepairs descending
    return repairDataList.sort((a, b) => b.totalRepairs - a.totalRepairs);
  }, [serviceHistory]);

  // Prepare data for bar chart - top 10 containers
  const chartData = useMemo(() => {
    return containerRepairData.slice(0, 10).map((item) => ({
      containerId: item.containerId,
      repairs: item.totalRepairs,
    }));
  }, [containerRepairData]);

  // Get selected container data
  const selectedContainerData = useMemo(() => {
    if (!selectedContainer) return null;
    return containerRepairData.find((item) => item.containerId === selectedContainer);
  }, [selectedContainer, containerRepairData]);

  // Get all service records for selected container
  const selectedContainerServices = useMemo(() => {
    if (!selectedContainer || !serviceHistory) return [];
    
    return serviceHistory
      .filter((record) => {
        if (record.container_number !== selectedContainer) return false;
        
        // Filter out incomplete or canceled records
        const status = (record.status || '').toLowerCase();
        const callStatus = (record.call_status || '').toLowerCase();
        
        if (
          status.includes('cancel') ||
          status.includes('incomplete') ||
          callStatus.includes('cancel') ||
          callStatus.includes('incomplete')
        ) {
          return false;
        }
        
        return record.complaint_attended_date;
      })
      .sort((a, b) => {
        const dateA = new Date(a.complaint_attended_date).getTime();
        const dateB = new Date(b.complaint_attended_date).getTime();
        return dateB - dateA; // Most recent first
      });
  }, [selectedContainer, serviceHistory]);

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (data && data.containerId) {
      setSelectedContainer(data.containerId);
      setShowFullDetails(false); // Reset to summary view
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Frequently Repaired Containers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Frequently Repaired Containers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bar Chart */}
        <div>
          <h3 className="text-sm font-medium mb-4">
            Top 10 Containers by Repair Count
            <span className="text-xs text-muted-foreground ml-2">(Click a bar to view details)</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="containerId"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="repairs" 
                fill="#ef4444" 
                name="Total Repairs" 
                onClick={handleBarClick}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Container Details */}
        {selectedContainerData ? (
          showFullDetails ? (
            // Full Details View - Service History Table
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullDetails(false)}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Summary
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSelectedContainer(null);
                    setShowFullDetails(false);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-muted/50 p-4 border-b">
                  <h3 className="text-sm font-medium">
                    Complete Service History for Container: <span className="font-mono">{selectedContainerData.containerId}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Services: {selectedContainerServices.length}
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">#</TableHead>
                        <TableHead>Job Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Service Type</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Issue Description</TableHead>
                        <TableHead>Work Description</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedContainerServices.map((service, index) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {service.job_order_number || 'N/A'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(service.complaint_attended_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{service.client_name || 'N/A'}</TableCell>
                          <TableCell>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {service.service_type || service.work_type || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>{service.technician_name || 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {service.issue_description || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {service.work_description || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {service.call_status || service.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            // Summary View
            <div 
              className="border rounded-lg p-4 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => setShowFullDetails(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowFullDetails(true);
                }
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">
                  Details for Container: <span className="font-mono">{selectedContainerData.containerId}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Click to view full history
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedContainer(null);
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Repairs</p>
                  <p className="text-2xl font-bold text-red-500">{selectedContainerData.totalRepairs}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Last Repair Date</p>
                  <p className="text-sm font-medium">
                    {new Date(selectedContainerData.lastRepairDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Days Since Last Repair</p>
                  <p className="text-2xl font-bold">{selectedContainerData.daysSinceLast}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Unique Defects</p>
                  <p className="text-2xl font-bold">{selectedContainerData.uniqueDefects}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">MTBF (Days)</p>
                  <p className="text-2xl font-bold">
                    {selectedContainerData.mtbfDays > 0 ? selectedContainerData.mtbfDays : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Click on a bar in the chart above to view detailed repair information for that container.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

