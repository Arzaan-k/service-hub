import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, AlertTriangle, Wifi, Battery, Power, Zap, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReeferUnit {
  stateIndicators: string;
  cc: string; // Communication status
  alm: string; // Alarm status
  run: string; // Running status
  pwr: string; // Power status
  oem: string;
  reeferId: string;
  containerId: string;
  event: string;
  eventTime: string;
  deviceFence: string;
  serverFence: string;
  city: string;
  temperature?: number;
  powerStatus?: string;
  batteryLevel?: number;
  errorCodes?: string[];
  container?: any;
}

interface DeviceStatus {
  deviceId: string;
  deviceBat: string;
  reporting: string;
  geofenceRevision: string;
  cellG: string;
  cellSi: string;
  comments: string;
  reeferId: string;
  containerId: string;
  status: string;
}

interface LiveDataResponse {
  success: boolean;
  dataSource: string;
  timestamp: string;
  reeferUnits: {
    total: number;
    data: ReeferUnit[];
  };
  deviceStatus: {
    total: number;
    data: DeviceStatus[];
  };
  message: string;
}

const OrbcommLiveData: React.FC = () => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const { data, isLoading, error, refetch } = useQuery<LiveDataResponse>({
    queryKey: ['orbcomm-live-data'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/orbcomm/live-data');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    onSuccess: () => {
      setLastUpdate(new Date());
    }
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading && !data) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
          <span>Loading live ORBCOMM data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading ORBCOMM Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Failed to load live ORBCOMM data'}
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ORBCOMM Live Data Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time container telemetry from ORBCOMM network with container matching
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {data && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-700">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">
                Connected to ORBCOMM Live Feed - {data.reeferUnits.total} containers monitored
              </span>
            </div>
            <p className="text-xs text-green-600 mt-1">{data.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Reefer Units Information Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Reefer Units Information
            {data && (
              <Badge variant="secondary" className="ml-2">
                {data.reeferUnits.total} units
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-time operational status and event details for refrigerated containers
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead>OEM</TableHead>
                  <TableHead>Reefer ID</TableHead>
                  <TableHead>Container ID</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Event Time (IST)</TableHead>
                  <TableHead>Geofence</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Power</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Alarms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.reeferUnits.data.map((unit, index) => (
                  <TableRow key={`${unit.reeferId}-${index}`}>
                    <TableCell>
                      <div className="flex items-center gap-1 text-lg">
                        <span title="Communication">{unit.cc}</span>
                        <span title="Alarm">{unit.alm}</span>
                        <span title="Running">{unit.run}</span>
                        <span title="Power">{unit.pwr}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{unit.oem}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {unit.reeferId}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {unit.containerId}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{unit.event}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {unit.eventTime}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {unit.deviceFence}/{unit.serverFence}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {unit.city}
                    </TableCell>
                    <TableCell>
                      {unit.temperature !== undefined ? (
                        <span className={cn(
                          "font-medium",
                          unit.temperature > 10 ? "text-red-600" : unit.temperature < -10 ? "text-blue-600" : "text-green-600"
                        )}>
                          {unit.temperature}°C
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={unit.powerStatus === 'on' ? 'default' : 'secondary'}>
                        {unit.powerStatus || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {unit.batteryLevel !== undefined ? (
                        <div className="flex items-center gap-1">
                          <Battery className={cn(
                            "h-4 w-4",
                            unit.batteryLevel > 80 ? "text-green-600" :
                            unit.batteryLevel > 50 ? "text-yellow-600" : "text-red-600"
                          )} />
                          <span className="text-sm">{unit.batteryLevel}V</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {unit.errorCodes && unit.errorCodes.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Bell className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-red-600">
                            {unit.errorCodes.join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.reeferUnits.data || data.reeferUnits.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No reefer units data available. Ensure ORBCOMM connection is active and containers have matching Reefer IDs.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Device Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Device Status
            {data && (
              <Badge variant="secondary" className="ml-2">
                {data.deviceStatus.total} devices
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hardware and connectivity details for ORBCOMM onboard devices
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Device Battery</TableHead>
                  <TableHead>Reporting</TableHead>
                  <TableHead>Geofence Revision</TableHead>
                  <TableHead>Cell Network</TableHead>
                  <TableHead>Signal Strength</TableHead>
                  <TableHead>Container ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.deviceStatus.data.map((device, index) => (
                  <TableRow key={`${device.deviceId}-${index}`}>
                    <TableCell className="font-mono text-sm">
                      {device.deviceId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Battery className="h-4 w-4 text-green-600" />
                        <span className="text-sm">{device.deviceBat}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {device.reporting}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {device.geofenceRevision}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{device.cellG}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Wifi className={cn(
                          "h-4 w-4",
                          device.cellSi.includes('5/5') ? "text-green-600" :
                          device.cellSi.includes('3/5') || device.cellSi.includes('4/5') ? "text-yellow-600" :
                          "text-red-600"
                        )} />
                        <span className="text-sm">{device.cellSi}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {device.containerId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        device.status === 'active' ? 'default' :
                        device.status === 'offline' ? 'destructive' : 'secondary'
                      }>
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-sm",
                        device.comments === 'Normal' ? "text-green-600" : "text-red-600"
                      )}>
                        {device.comments}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.deviceStatus.data || data.deviceStatus.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No device status data available. Ensure ORBCOMM connection is active and devices are reporting.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Data Source:</strong> {data?.dataSource || 'ORBCOMM Live Feed'}</p>
            <p><strong>Last API Call:</strong> {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}</p>
            <p><strong>Auto-refresh:</strong> Every 30 seconds</p>
            <p className="text-xs text-blue-600 mt-2">
              Only containers with matching Reefer IDs (AssetID) from ORBCOMM are displayed. Ensure your container database has the correct Reefer ID values.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrbcommLiveData;
