import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { format, subDays, subHours, isAfter, parseISO } from 'date-fns';
import {
  Thermometer, Activity, Battery, Power, Gauge,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar
} from 'lucide-react';

interface ContainerAnalyticsProps {
  container: any;
  alerts: any[];
}

export function ContainerAnalytics({ container, alerts }: ContainerAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<string>("all");

  // Filter alerts for this specific container and time range
  const containerAlerts = useMemo(() => {
    let filtered = alerts.filter(alert =>
      alert.containerId === container.id ||
      alert.rawData?.Event?.ReeferData?.AssetID === container.containerNumber ||
      alert.rawData?.Event?.DeviceData?.LastAssetID === container.containerNumber
    );

    // Apply time range filter
    if (timeRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (timeRange) {
        case "24h":
          cutoffDate = subHours(now, 24);
          break;
        case "7d":
          cutoffDate = subDays(now, 7);
          break;
        case "30d":
          cutoffDate = subDays(now, 30);
          break;
        case "90d":
          cutoffDate = subDays(now, 90);
          break;
        default:
          return filtered;
      }

      filtered = filtered.filter(alert => {
        const alertDate = alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt;
        if (!alertDate) return false;
        return isAfter(parseISO(alertDate), cutoffDate);
      });
    }

    return filtered;
  }, [alerts, container, timeRange]);

  // Temperature Performance Over Time
  const temperatureData = useMemo(() => {
    const dataMap: Map<string, {
      timestamp: string;
      ambient: number[];
      return1: number[];
      return2: number[];
      supply1: number[];
      supply2: number[];
      setpoint: number[];
    }> = new Map();

    containerAlerts.forEach(alert => {
      const reeferData = alert.rawData?.Event?.ReeferData;
      if (!reeferData) return;

      const timestamp = alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt;
      if (!timestamp) return;

      const hourKey = format(new Date(timestamp), 'MM/dd HH:mm');

      if (!dataMap.has(hourKey)) {
        dataMap.set(hourKey, {
          timestamp: hourKey,
          ambient: [],
          return1: [],
          return2: [],
          supply1: [],
          supply2: [],
          setpoint: []
        });
      }

      const data = dataMap.get(hourKey)!;
      if (reeferData.TAmb !== null && reeferData.TAmb !== undefined) data.ambient.push(reeferData.TAmb);
      if (reeferData.TRtn1 !== null && reeferData.TRtn1 !== undefined) data.return1.push(reeferData.TRtn1);
      if (reeferData.TRtn2 !== null && reeferData.TRtn2 !== undefined) data.return2.push(reeferData.TRtn2);
      if (reeferData.TSup1 !== null && reeferData.TSup1 !== undefined) data.supply1.push(reeferData.TSup1);
      if (reeferData.TSup2 !== null && reeferData.TSup2 !== undefined) data.supply2.push(reeferData.TSup2);
      if (reeferData.TSet !== null && reeferData.TSet !== undefined) data.setpoint.push(reeferData.TSet);
    });

    return Array.from(dataMap.values())
      .map(d => ({
        time: d.timestamp,
        ambient: d.ambient.length > 0 ? parseFloat((d.ambient.reduce((a, b) => a + b, 0) / d.ambient.length).toFixed(1)) : null,
        return: d.return1.length > 0 ? parseFloat((d.return1.reduce((a, b) => a + b, 0) / d.return1.length).toFixed(1)) : null,
        supply: d.supply1.length > 0 ? parseFloat((d.supply1.reduce((a, b) => a + b, 0) / d.supply1.length).toFixed(1)) : null,
        setpoint: d.setpoint.length > 0 ? parseFloat((d.setpoint.reduce((a, b) => a + b, 0) / d.setpoint.length).toFixed(1)) : null,
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(-48); // Last 48 data points
  }, [containerAlerts]);

  // Power and Battery Performance
  const powerData = useMemo(() => {
    const dataMap: Map<string, {
      timestamp: string;
      battery: number[];
      extPower: number[];
      totalDraw: number[];
    }> = new Map();

    containerAlerts.forEach(alert => {
      const deviceData = alert.rawData?.Event?.DeviceData;
      const reeferData = alert.rawData?.Event?.ReeferData;
      if (!deviceData) return;

      const timestamp = alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt;
      if (!timestamp) return;

      const hourKey = format(new Date(timestamp), 'MM/dd HH:mm');

      if (!dataMap.has(hourKey)) {
        dataMap.set(hourKey, {
          timestamp: hourKey,
          battery: [],
          extPower: [],
          totalDraw: []
        });
      }

      const data = dataMap.get(hourKey)!;
      if (deviceData.BatteryVoltage) data.battery.push(deviceData.BatteryVoltage);
      if (deviceData.ExtPowerVoltage) data.extPower.push(deviceData.ExtPowerVoltage);
      if (reeferData?.AmpTotalDraw) data.totalDraw.push(reeferData.AmpTotalDraw);
    });

    return Array.from(dataMap.values())
      .map(d => ({
        time: d.timestamp,
        battery: d.battery.length > 0 ? parseFloat((d.battery.reduce((a, b) => a + b, 0) / d.battery.length).toFixed(1)) : null,
        extPower: d.extPower.length > 0 ? parseFloat((d.extPower.reduce((a, b) => a + b, 0) / d.extPower.length).toFixed(1)) : null,
        current: d.totalDraw.length > 0 ? parseFloat((d.totalDraw.reduce((a, b) => a + b, 0) / d.totalDraw.length).toFixed(1)) : null,
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(-48);
  }, [containerAlerts]);

  // Alert Distribution by Type
  const alertDistribution = useMemo(() => {
    const distribution: { [key: string]: number } = {
      temperature: 0,
      power: 0,
      door: 0,
      error: 0,
      other: 0
    };

    containerAlerts.forEach(alert => {
      const type = alert.type?.toLowerCase() || '';
      const severity = alert.severity?.toLowerCase() || '';

      if (type.includes('temperature') || severity.includes('temperature')) {
        distribution.temperature++;
      } else if (type.includes('power') || severity.includes('power')) {
        distribution.power++;
      } else if (type.includes('door')) {
        distribution.door++;
      } else if (type.includes('error')) {
        distribution.error++;
      } else {
        distribution.other++;
      }
    });

    return Object.entries(distribution)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));
  }, [containerAlerts]);

  // Performance Metrics
  const performanceMetrics = useMemo(() => {
    if (temperatureData.length === 0) return null;

    const tempReadings = temperatureData.filter(d => d.ambient !== null).map(d => d.ambient!);
    const setpointReadings = temperatureData.filter(d => d.setpoint !== null).map(d => d.setpoint!);

    const avgTemp = tempReadings.length > 0 ? tempReadings.reduce((a, b) => a + b, 0) / tempReadings.length : 0;
    const avgSetpoint = setpointReadings.length > 0 ? setpointReadings.reduce((a, b) => a + b, 0) / setpointReadings.length : 0;
    const tempDeviation = Math.abs(avgTemp - avgSetpoint);

    // Calculate uptime (percentage of time with external power)
    const powerReadings = powerData.filter(d => d.extPower !== null && d.extPower! > 0);
    const uptime = powerData.length > 0 ? (powerReadings.length / powerData.length) * 100 : 0;

    // Calculate temperature stability (lower is better)
    const tempVariance = tempReadings.length > 1
      ? tempReadings.reduce((acc, temp) => acc + Math.pow(temp - avgTemp, 2), 0) / tempReadings.length
      : 0;
    const tempStability = Math.sqrt(tempVariance);

    return {
      avgTemp: avgTemp.toFixed(1),
      avgSetpoint: avgSetpoint.toFixed(1),
      tempDeviation: tempDeviation.toFixed(1),
      tempStability: tempStability.toFixed(1),
      uptime: uptime.toFixed(1),
      alertCount: containerAlerts.length,
      criticalAlerts: containerAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length
    };
  }, [temperatureData, powerData, containerAlerts]);

  const COLORS = {
    temperature: '#ef4444',
    power: '#f59e0b',
    door: '#3b82f6',
    error: '#8b5cf6',
    other: '#6b7280'
  };

  if (containerAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No analytics data available for this container</p>
          <p className="text-sm mt-1">Data will appear once alerts are recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Filter */}
      <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg border">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">Time Range</p>
          <p className="text-xs text-muted-foreground">Select the time period for analytics data</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Performance Summary Cards */}
      {performanceMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Thermometer className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Avg Temperature</p>
                  <p className="text-2xl font-bold">{performanceMetrics.avgTemp}°C</p>
                  <p className="text-xs text-muted-foreground">Target: {performanceMetrics.avgSetpoint}°C</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Gauge className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Temp Deviation</p>
                  <p className="text-2xl font-bold">{performanceMetrics.tempDeviation}°C</p>
                  <p className="text-xs text-muted-foreground">
                    Stability: ±{performanceMetrics.tempStability}°C
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Power className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="text-2xl font-bold">{performanceMetrics.uptime}%</p>
                  <p className="text-xs text-muted-foreground">Power availability</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{performanceMetrics.alertCount}</p>
                  <p className="text-xs text-red-600">{performanceMetrics.criticalAlerts} critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Temperature Performance Chart */}
      {temperatureData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Temperature Performance</CardTitle>
            <CardDescription>Ambient, return, and supply air temperatures over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={temperatureData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="setpoint" stroke="#6b7280" strokeWidth={2} dot={false} name="Setpoint" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="ambient" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Ambient" />
                <Line type="monotone" dataKey="return" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="Return Air" />
                <Line type="monotone" dataKey="supply" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Supply Air" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Power and Battery Chart */}
        {powerData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Power & Battery Status</CardTitle>
              <CardDescription>Voltage levels and current draw</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={powerData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="extPower" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Ext Power (V)" />
                  <Area type="monotone" dataKey="battery" stackId="2" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Battery (V)" />
                  <Line type="monotone" dataKey="current" stroke="#f59e0b" strokeWidth={2} name="Current (A)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Alert Distribution */}
        {alertDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alert Distribution</CardTitle>
              <CardDescription>Breakdown of alerts by type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={alertDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {alertDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.other} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
