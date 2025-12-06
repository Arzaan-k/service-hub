import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Thermometer, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface PerContainerTemperatureProps {
  alerts: any[];
  containers: any[];
}

interface TemperatureDataPoint {
  timestamp: string;
  temperature: number;
  severity: string;
  date: Date;
  alertId: string;
}

interface ContainerTemperatureData {
  containerId: string;
  containerCode: string;
  data: TemperatureDataPoint[];
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  alertCount: number;
  criticalCount: number;
  trend: 'up' | 'down' | 'stable';
}

export function PerContainerTemperature({ alerts, containers }: PerContainerTemperatureProps) {
  const [selectedContainer, setSelectedContainer] = useState<string>("all");

  // Extract and organize temperature data by container
  const containerTemperatureData = useMemo(() => {
    const dataByContainer: Record<string, ContainerTemperatureData> = {};

    alerts.forEach(alert => {
      // Extract temperature from alert data
      let temperature: number | null = null;

      if (alert.rawData?.Event?.ReeferData?.TAmb !== undefined) {
        temperature = alert.rawData.Event.ReeferData.TAmb;
      } else if (alert.rawData?.Event?.DeviceData?.DeviceTemp !== undefined) {
        temperature = alert.rawData.Event.DeviceData.DeviceTemp;
      } else if (alert.rawData?.ReeferData?.TAmb !== undefined) {
        temperature = alert.rawData.ReeferData.TAmb;
      } else if (alert.rawData?.DeviceData?.DeviceTemp !== undefined) {
        temperature = alert.rawData.DeviceData.DeviceTemp;
      } else if (alert.rawData?.Temperature !== undefined) {
        temperature = alert.rawData.Temperature;
      } else if (alert.temperature !== undefined && alert.temperature !== null) {
        temperature = alert.temperature;
      }

      if (temperature !== null && !isNaN(temperature) && alert.containerId) {
        const containerId = alert.containerId;
        const container = containers.find((c: any) => c.id === containerId);
        const timestamp = new Date(alert.timestamp || alert.createdAt);

        if (!dataByContainer[containerId]) {
          dataByContainer[containerId] = {
            containerId,
            containerCode: container?.containerCode || `Container ${containerId.slice(0, 8)}`,
            data: [],
            minTemp: Infinity,
            maxTemp: -Infinity,
            avgTemp: 0,
            alertCount: 0,
            criticalCount: 0,
            trend: 'stable'
          };
        }

        const dataPoint: TemperatureDataPoint = {
          timestamp: timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          temperature: Math.round(temperature * 10) / 10,
          severity: alert.severity,
          date: timestamp,
          alertId: alert.id
        };

        dataByContainer[containerId].data.push(dataPoint);
        dataByContainer[containerId].alertCount++;

        if (alert.severity === 'critical' || alert.severity === 'high') {
          dataByContainer[containerId].criticalCount++;
        }

        // Update min/max
        if (temperature < dataByContainer[containerId].minTemp) {
          dataByContainer[containerId].minTemp = temperature;
        }
        if (temperature > dataByContainer[containerId].maxTemp) {
          dataByContainer[containerId].maxTemp = temperature;
        }
      }
    });

    // Calculate averages and trends
    Object.values(dataByContainer).forEach(containerData => {
      // Sort by date
      containerData.data.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate average
      const sum = containerData.data.reduce((acc, d) => acc + d.temperature, 0);
      containerData.avgTemp = Math.round((sum / containerData.data.length) * 10) / 10;

      // Calculate trend (compare first half to second half)
      if (containerData.data.length >= 4) {
        const halfPoint = Math.floor(containerData.data.length / 2);
        const firstHalf = containerData.data.slice(0, halfPoint);
        const secondHalf = containerData.data.slice(halfPoint);

        const firstAvg = firstHalf.reduce((acc, d) => acc + d.temperature, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((acc, d) => acc + d.temperature, 0) / secondHalf.length;

        const diff = secondAvg - firstAvg;
        if (diff > 2) {
          containerData.trend = 'up';
        } else if (diff < -2) {
          containerData.trend = 'down';
        } else {
          containerData.trend = 'stable';
        }
      }
    });

    return Object.values(dataByContainer).sort((a, b) =>
      b.criticalCount - a.criticalCount || b.alertCount - a.alertCount
    );
  }, [alerts, containers]);

  const selectedContainerData = useMemo(() => {
    if (selectedContainer === "all") {
      return containerTemperatureData;
    }
    return containerTemperatureData.filter(c => c.containerId === selectedContainer);
  }, [selectedContainer, containerTemperatureData]);

  if (containerTemperatureData.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Container Temperature Monitoring</CardTitle>
              <CardDescription>Per-container temperature trends from Orbcomm alerts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Thermometer className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No temperature data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-muted-foreground mb-1">{data.timestamp}</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {data.temperature}°C
          </p>
          <p className="text-xs capitalize mt-1">
            <span className={`inline-block px-2 py-0.5 rounded ${
              data.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              data.severity === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
              data.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {data.severity}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-blue-500" />;
    return <div className="w-4 h-4" />;
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Container Temperature Monitoring</CardTitle>
              <CardDescription>
                {selectedContainer === "all"
                  ? `Monitoring ${containerTemperatureData.length} containers`
                  : "Individual container temperature trend"
                }
              </CardDescription>
            </div>
          </div>

          <Select value={selectedContainer} onValueChange={setSelectedContainer}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select container" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Containers ({containerTemperatureData.length})</SelectItem>
              {containerTemperatureData.map(container => (
                <SelectItem key={container.containerId} value={container.containerId}>
                  {container.containerCode} ({container.alertCount} alerts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {selectedContainer === "all" ? (
          // Grid view for all containers
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {containerTemperatureData.map(container => (
              <Card
                key={container.containerId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedContainer(container.containerId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-semibold">{container.containerCode}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(container.trend)}
                        <span className="text-xs text-muted-foreground capitalize">{container.trend} trend</span>
                      </div>
                    </div>
                    {container.criticalCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {container.criticalCount}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {container.minTemp}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg</p>
                      <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        {container.avgTemp}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">
                        {container.maxTemp}°C
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={container.data}>
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                        />
                        <ReferenceLine y={-30} stroke="#3b82f6" strokeDasharray="3 3" />
                        <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Detail view for single container
          selectedContainerData.map(container => (
            <div key={container.containerId} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{container.containerCode}</h3>
                  <p className="text-sm text-muted-foreground">
                    {container.alertCount} temperature readings
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Min</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">{container.minTemp}°C</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Avg</p>
                    <p className="font-bold text-orange-600 dark:text-orange-400">{container.avgTemp}°C</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Max</p>
                    <p className="font-bold text-red-600 dark:text-red-400">{container.maxTemp}°C</p>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={container.data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis
                    dataKey="timestamp"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />

                  <ReferenceLine
                    y={-30}
                    stroke="#3b82f6"
                    strokeDasharray="3 3"
                    label={{ value: 'Critical Low (-30°C)', position: 'left', fill: '#3b82f6', fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={35}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'Critical High (35°C)', position: 'right', fill: '#ef4444', fontSize: 11 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#f97316' }}
                    activeDot={{ r: 7 }}
                    name="Temperature (°C)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
