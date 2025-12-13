import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Scatter
} from 'recharts';
import { format, subDays, subHours, isAfter, parseISO, differenceInHours } from 'date-fns';
import {
  Thermometer, Activity, Battery, Power, Gauge, Zap,
  TrendingUp, TrendingDown, AlertTriangle, Calendar, CheckCircle, XCircle
} from 'lucide-react';

interface ContainerAnalyticsProps {
  container: any;
  alerts: any[];
}

export function ContainerAnalytics({ container, alerts }: ContainerAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<string>("7d");

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
        try {
          return isAfter(new Date(alertDate), cutoffDate);
        } catch {
          return false;
        }
      });
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.rawData?.Event?.MessageData?.EventDtm || a.createdAt);
      const dateB = new Date(b.rawData?.Event?.MessageData?.EventDtm || b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
  }, [alerts, container, timeRange]);

  // 1. TEMPERATURE ANALYSIS - Comprehensive temperature tracking
  const temperatureAnalysis = useMemo(() => {
    const readings: Array<{
      timestamp: Date;
      ambient: number | null;
      return1: number | null;
      return2: number | null;
      supply1: number | null;
      supply2: number | null;
      setpoint: number | null;
      evap: number | null;
    }> = [];

    containerAlerts.forEach(alert => {
      const reeferData = alert.rawData?.Event?.ReeferData;
      if (!reeferData) return;

      const timestamp = new Date(alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt);

      readings.push({
        timestamp,
        ambient: reeferData.TAmb ?? null,
        return1: reeferData.TRtn1 ?? null,
        return2: reeferData.TRtn2 ?? null,
        supply1: reeferData.TSup1 ?? null,
        supply2: reeferData.TSup2 ?? null,
        setpoint: reeferData.TSet ?? null,
        evap: reeferData.TEvap ?? null
      });
    });

    // Calculate statistics
    const ambientTemps = readings.map(r => r.ambient).filter(t => t !== null) as number[];
    const returnTemps = readings.map(r => r.return1).filter(t => t !== null) as number[];
    const supplyTemps = readings.map(r => r.supply1).filter(t => t !== null) as number[];
    const setpoints = readings.map(r => r.setpoint).filter(t => t !== null) as number[];

    const calcStats = (temps: number[]) => {
      if (temps.length === 0) return null;
      const sorted = [...temps].sort((a, b) => a - b);
      return {
        avg: temps.reduce((a, b) => a + b, 0) / temps.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)],
        stdDev: Math.sqrt(temps.reduce((sum, t) => sum + Math.pow(t - (temps.reduce((a, b) => a + b, 0) / temps.length), 2), 0) / temps.length)
      };
    };

    // Chart data - sample every Nth point for performance
    const sampleRate = Math.max(1, Math.floor(readings.length / 100));
    const chartData = readings
      .filter((_, i) => i % sampleRate === 0)
      .map(r => ({
        time: format(r.timestamp, 'MM/dd HH:mm'),
        fullTime: r.timestamp,
        ambient: r.ambient,
        return: r.return1,
        supply: r.supply1,
        setpoint: r.setpoint,
        evap: r.evap
      }));

    return {
      readings: readings.length,
      ambient: calcStats(ambientTemps),
      return: calcStats(returnTemps),
      supply: calcStats(supplyTemps),
      setpoint: setpoints.length > 0 ? setpoints[setpoints.length - 1] : null,
      chartData,
      // Temperature deviation from setpoint
      deviations: ambientTemps.map((t, i) => {
        const sp = setpoints[i] || setpoints[setpoints.length - 1];
        return sp ? Math.abs(t - sp) : 0;
      }),
      // Time in critical zones
      criticalLow: ambientTemps.filter(t => t < -30).length,
      criticalHigh: ambientTemps.filter(t => t > 35).length,
      warningLow: ambientTemps.filter(t => t >= -30 && t < -25).length,
      warningHigh: ambientTemps.filter(t => t > 30 && t <= 35).length,
    };
  }, [containerAlerts]);

  // 2. POWER & ENERGY ANALYSIS
  const powerAnalysis = useMemo(() => {
    const readings: Array<{
      timestamp: Date;
      battery: number | null;
      extPower: number | null;
      currentDraw: number | null;
      isPowered: boolean;
    }> = [];

    containerAlerts.forEach(alert => {
      const deviceData = alert.rawData?.Event?.DeviceData;
      const reeferData = alert.rawData?.Event?.ReeferData;
      if (!deviceData) return;

      const timestamp = new Date(alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt);

      readings.push({
        timestamp,
        battery: deviceData.BatteryVoltage ?? null,
        extPower: deviceData.ExtPowerVoltage ?? null,
        currentDraw: reeferData?.AmpTotalDraw ?? null,
        isPowered: deviceData.ExtPower === true || (deviceData.ExtPowerVoltage ?? 0) > 0
      });
    });

    // Calculate uptime and power loss events
    const powerLossEvents: Array<{ start: Date; end: Date; duration: number }> = [];
    let lossStart: Date | null = null;

    readings.forEach((r, i) => {
      if (!r.isPowered && lossStart === null) {
        lossStart = r.timestamp;
      } else if (r.isPowered && lossStart !== null) {
        const duration = differenceInHours(r.timestamp, lossStart);
        powerLossEvents.push({ start: lossStart, end: r.timestamp, duration });
        lossStart = null;
      }
    });

    const uptimePercent = readings.length > 0
      ? (readings.filter(r => r.isPowered).length / readings.length) * 100
      : 0;

    // Chart data
    const sampleRate = Math.max(1, Math.floor(readings.length / 100));
    const chartData = readings
      .filter((_, i) => i % sampleRate === 0)
      .map(r => ({
        time: format(r.timestamp, 'MM/dd HH:mm'),
        battery: r.battery,
        extPower: r.extPower,
        current: r.currentDraw,
        status: r.isPowered ? 1 : 0
      }));

    const batteryLevels = readings.map(r => r.battery).filter(b => b !== null) as number[];
    const currentDraws = readings.map(r => r.currentDraw).filter(c => c !== null) as number[];

    return {
      uptime: uptimePercent,
      powerLossEvents: powerLossEvents.length,
      totalPowerLossHours: powerLossEvents.reduce((sum, e) => sum + e.duration, 0),
      avgBattery: batteryLevels.length > 0 ? batteryLevels.reduce((a, b) => a + b, 0) / batteryLevels.length : null,
      minBattery: batteryLevels.length > 0 ? Math.min(...batteryLevels) : null,
      avgCurrent: currentDraws.length > 0 ? currentDraws.reduce((a, b) => a + b, 0) / currentDraws.length : null,
      maxCurrent: currentDraws.length > 0 ? Math.max(...currentDraws) : null,
      chartData
    };
  }, [containerAlerts]);

  // 3. DOOR STATUS ANALYSIS
  const doorAnalysis = useMemo(() => {
    const doorEvents: Array<{ timestamp: Date; status: string }> = [];

    containerAlerts.forEach(alert => {
      const deviceData = alert.rawData?.Event?.DeviceData;
      if (!deviceData?.DoorState) return;

      const timestamp = new Date(alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt);
      doorEvents.push({ timestamp, status: deviceData.DoorState });
    });

    const openEvents = doorEvents.filter(e => e.status.toLowerCase() === 'open');
    const closedEvents = doorEvents.filter(e => e.status.toLowerCase() === 'closed');

    return {
      totalChanges: doorEvents.length,
      openCount: openEvents.length,
      closedCount: closedEvents.length,
      disconnectedCount: doorEvents.filter(e => e.status.toLowerCase() === 'disconnected').length
    };
  }, [containerAlerts]);

  // 4. REEFER ALARM ANALYSIS
  const alarmAnalysis = useMemo(() => {
    const alarmCounts: Record<string, number> = {};
    const alarmSeverity: Record<string, { critical: number; minor: number; info: number }> = {};

    containerAlerts.forEach(alert => {
      const alarms = alert.rawData?.Event?.ReeferData?.ReeferAlarms;
      if (!alarms || !Array.isArray(alarms)) return;

      alarms.forEach((alarm: any) => {
        const code = alarm.RCAlias || alarm.OemAlarm || 'Unknown';
        alarmCounts[code] = (alarmCounts[code] || 0) + 1;

        if (!alarmSeverity[code]) {
          alarmSeverity[code] = { critical: 0, minor: 0, info: 0 };
        }

        const sev = alarm.RCSeverity?.toLowerCase() || 'info';
        if (sev.includes('critical')) alarmSeverity[code].critical++;
        else if (sev.includes('minor')) alarmSeverity[code].minor++;
        else alarmSeverity[code].info++;
      });
    });

    const topAlarms = Object.entries(alarmCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, count]) => ({
        code,
        count,
        severity: alarmSeverity[code]
      }));

    return {
      uniqueAlarms: Object.keys(alarmCounts).length,
      totalOccurrences: Object.values(alarmCounts).reduce((a, b) => a + b, 0),
      topAlarms
    };
  }, [containerAlerts]);

  // 5. COMPRESSOR & SYSTEM PERFORMANCE
  const systemPerformance = useMemo(() => {
    const readings: Array<{
      timestamp: Date;
      compressorMode: string | null;
      dischargePressure: number | null;
      suctionPressure: number | null;
      dischargeTemp: number | null;
      suctionTemp: number | null;
      condenserMode: string | null;
    }> = [];

    containerAlerts.forEach(alert => {
      const reeferData = alert.rawData?.Event?.ReeferData;
      if (!reeferData) return;

      const timestamp = new Date(alert.rawData?.Event?.MessageData?.EventDtm || alert.createdAt);

      readings.push({
        timestamp,
        compressorMode: reeferData.MCtrl2 || null,
        dischargePressure: reeferData.PDis ?? null,
        suctionPressure: reeferData.PSuc ?? null,
        dischargeTemp: reeferData.TDis ?? null,
        suctionTemp: reeferData.TSuc ?? null,
        condenserMode: reeferData.MCond || null
      });
    });

    const modeCounts: Record<string, number> = {};
    readings.forEach(r => {
      if (r.compressorMode) {
        modeCounts[r.compressorMode] = (modeCounts[r.compressorMode] || 0) + 1;
      }
    });

    return {
      totalReadings: readings.length,
      compressorModes: modeCounts,
      avgDischargePressure: readings.map(r => r.dischargePressure).filter(p => p !== null).reduce((a: number, b) => a + (b as number), 0) / readings.length || null,
      avgSuctionPressure: readings.map(r => r.suctionPressure).filter(p => p !== null).reduce((a: number, b) => a + (b as number), 0) / readings.length || null
    };
  }, [containerAlerts]);

  // 6. ATMOSPHERIC CONTROL (for CA containers)
  const atmosphericAnalysis = useMemo(() => {
    const o2Readings: number[] = [];
    const co2Readings: number[] = [];
    const humidityReadings: number[] = [];

    containerAlerts.forEach(alert => {
      const reeferData = alert.rawData?.Event?.ReeferData;
      if (!reeferData) return;

      if (reeferData.PctO2 !== null && reeferData.PctO2 !== undefined) o2Readings.push(reeferData.PctO2);
      if (reeferData.PctCO2 !== null && reeferData.PctCO2 !== undefined) co2Readings.push(reeferData.PctCO2);
      if (reeferData.PctHum !== null && reeferData.PctHum !== undefined) humidityReadings.push(reeferData.PctHum);
    });

    return {
      hasAtmosphericControl: o2Readings.length > 0 || co2Readings.length > 0,
      o2: o2Readings.length > 0 ? {
        avg: o2Readings.reduce((a, b) => a + b, 0) / o2Readings.length,
        min: Math.min(...o2Readings),
        max: Math.max(...o2Readings)
      } : null,
      co2: co2Readings.length > 0 ? {
        avg: co2Readings.reduce((a, b) => a + b, 0) / co2Readings.length,
        min: Math.min(...co2Readings),
        max: Math.max(...co2Readings)
      } : null,
      humidity: humidityReadings.length > 0 ? {
        avg: humidityReadings.reduce((a, b) => a + b, 0) / humidityReadings.length,
        min: Math.min(...humidityReadings),
        max: Math.max(...humidityReadings)
      } : null
    };
  }, [containerAlerts]);

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

  const COLORS = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#eab308',
    low: '#3b82f6',
    success: '#10b981'
  };

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

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {temperatureAnalysis.ambient && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Thermometer className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Avg Temperature</p>
                  <p className="text-2xl font-bold">{temperatureAnalysis.ambient.avg.toFixed(1)}°C</p>
                  <p className="text-xs text-muted-foreground">σ: ±{temperatureAnalysis.ambient.stdDev.toFixed(1)}°C</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Power className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">System Uptime</p>
                <p className="text-2xl font-bold">{powerAnalysis.uptime.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {powerAnalysis.powerLossEvents} power loss events
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Unique Alarms</p>
                <p className="text-2xl font-bold">{alarmAnalysis.uniqueAlarms}</p>
                <p className="text-xs text-muted-foreground">
                  {alarmAnalysis.totalOccurrences} total occurrences
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Data Points</p>
                <p className="text-2xl font-bold">{temperatureAnalysis.readings}</p>
                <p className="text-xs text-muted-foreground">
                  readings analyzed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Temperature Performance Chart */}
      {temperatureAnalysis.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Temperature Performance Over Time</CardTitle>
            <CardDescription>
              Ambient, return, and supply air temperatures with setpoint tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={temperatureAnalysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" label="Critical Low" />
                <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label="Critical High" />
                {temperatureAnalysis.setpoint && (
                  <ReferenceLine
                    y={temperatureAnalysis.setpoint}
                    stroke="#6b7280"
                    strokeDasharray="5 5"
                    label="Setpoint"
                  />
                )}
                <Line type="monotone" dataKey="ambient" stroke="#3b82f6" strokeWidth={2} dot={false} name="Ambient" />
                <Line type="monotone" dataKey="return" stroke="#10b981" strokeWidth={2} dot={false} name="Return Air" />
                <Line type="monotone" dataKey="supply" stroke="#f59e0b" strokeWidth={2} dot={false} name="Supply Air" />
                {temperatureAnalysis.chartData.some(d => d.evap !== null) && (
                  <Line type="monotone" dataKey="evap" stroke="#8b5cf6" strokeWidth={1} dot={false} name="Evaporator" />
                )}
              </LineChart>
            </ResponsiveContainer>

            {/* Temperature Zone Analysis */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Critical Low</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {temperatureAnalysis.criticalLow}
                </p>
                <p className="text-xs text-muted-foreground">readings &lt; -30°C</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Warning Low</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {temperatureAnalysis.warningLow}
                </p>
                <p className="text-xs text-muted-foreground">-30°C to -25°C</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Warning High</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {temperatureAnalysis.warningHigh}
                </p>
                <p className="text-xs text-muted-foreground">30°C to 35°C</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Critical High</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {temperatureAnalysis.criticalHigh}
                </p>
                <p className="text-xs text-muted-foreground">readings &gt; 35°C</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Temperature Fluctuation Analysis */}
      {temperatureAnalysis.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Temperature Fluctuation Analysis</CardTitle>
            <CardDescription>
              Detailed temperature variations and stability assessment over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Fluctuation Chart */}
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={temperatureAnalysis.chartData}>
                <defs>
                  <linearGradient id="fluctuationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      ambient: 'Ambient Temp',
                      return: 'Return Air',
                      supply: 'Supply Air'
                    };
                    return [`${value}°C`, labels[name] || name];
                  }}
                />
                <Legend />

                {/* Reference lines for critical zones */}
                <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />

                {/* Setpoint reference */}
                {temperatureAnalysis.setpoint && (
                  <ReferenceLine
                    y={temperatureAnalysis.setpoint}
                    stroke="#6b7280"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                )}

                {/* Temperature bands as areas */}
                <Area
                  type="monotone"
                  dataKey="ambient"
                  fill="url(#fluctuationGradient)"
                  stroke="none"
                  fillOpacity={1}
                />

                {/* Main temperature lines */}
                <Line
                  type="monotone"
                  dataKey="ambient"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 2 }}
                  activeDot={{ r: 5 }}
                  name="Ambient"
                />
                <Line
                  type="monotone"
                  dataKey="return"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Return Air"
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="supply"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Supply Air"
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Fluctuation Statistics */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Temperature Range</p>
                  <Thermometer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                {temperatureAnalysis.ambient && (
                  <>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {(temperatureAnalysis.ambient.max - temperatureAnalysis.ambient.min).toFixed(1)}°C
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {temperatureAnalysis.ambient.min.toFixed(1)}°C to {temperatureAnalysis.ambient.max.toFixed(1)}°C
                    </p>
                  </>
                )}
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Stability (σ)</p>
                  <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                {temperatureAnalysis.ambient && (
                  <>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      ±{temperatureAnalysis.ambient.stdDev.toFixed(2)}°C
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {temperatureAnalysis.ambient.stdDev < 2 ? 'Excellent' :
                       temperatureAnalysis.ambient.stdDev < 4 ? 'Good' :
                       temperatureAnalysis.ambient.stdDev < 6 ? 'Fair' : 'Poor'} stability
                    </p>
                  </>
                )}
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Avg Deviation</p>
                  <Gauge className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                {temperatureAnalysis.deviations.length > 0 && (
                  <>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {(temperatureAnalysis.deviations.reduce((a, b) => a + b, 0) / temperatureAnalysis.deviations.length).toFixed(2)}°C
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      From setpoint
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Fluctuation Insights */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Temperature Behavior Insights
              </h4>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {temperatureAnalysis.ambient && (
                  <>
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        temperatureAnalysis.ambient.stdDev < 2 ? 'bg-green-500' :
                        temperatureAnalysis.ambient.stdDev < 4 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium">Temperature Stability</p>
                        <p className="text-xs text-muted-foreground">
                          {temperatureAnalysis.ambient.stdDev < 2
                            ? 'Excellent - very stable temperature control with minimal fluctuations'
                            : temperatureAnalysis.ambient.stdDev < 4
                            ? 'Good - acceptable temperature variations within normal range'
                            : temperatureAnalysis.ambient.stdDev < 6
                            ? 'Fair - noticeable fluctuations, monitor compressor performance'
                            : 'Poor - high fluctuations detected, system may need maintenance'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        (temperatureAnalysis.criticalLow + temperatureAnalysis.criticalHigh) === 0 ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium">Critical Zone Exposure</p>
                        <p className="text-xs text-muted-foreground">
                          {(temperatureAnalysis.criticalLow + temperatureAnalysis.criticalHigh) === 0
                            ? 'No critical temperature violations detected'
                            : `${temperatureAnalysis.criticalLow + temperatureAnalysis.criticalHigh} critical readings - immediate attention required`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 bg-blue-500" />
                      <div>
                        <p className="font-medium">Temperature Distribution</p>
                        <p className="text-xs text-muted-foreground">
                          Median: {temperatureAnalysis.ambient.median.toFixed(1)}°C |
                          Range: {(temperatureAnalysis.ambient.max - temperatureAnalysis.ambient.min).toFixed(1)}°C spread
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        temperatureAnalysis.deviations.length > 0 &&
                        (temperatureAnalysis.deviations.reduce((a, b) => a + b, 0) / temperatureAnalysis.deviations.length) < 2
                          ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium">Setpoint Tracking</p>
                        <p className="text-xs text-muted-foreground">
                          {temperatureAnalysis.deviations.length > 0
                            ? `Average ${(temperatureAnalysis.deviations.reduce((a, b) => a + b, 0) / temperatureAnalysis.deviations.length).toFixed(2)}°C deviation from target`
                            : 'Setpoint data not available'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Power & Energy Analysis */}
        {powerAnalysis.chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Power & Energy Performance</CardTitle>
              <CardDescription>External power, battery status, and current draw</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={powerAnalysis.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="voltage" label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="current" orientation="right" label={{ value: 'Current (A)', angle: 90, position: 'insideRight', fontSize: 10 }} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Area yAxisId="voltage" type="monotone" dataKey="extPower" fill="#10b981" stroke="#10b981" fillOpacity={0.3} name="Ext Power (V)" />
                  <Line yAxisId="voltage" type="monotone" dataKey="battery" stroke="#3b82f6" strokeWidth={2} name="Battery (V)" />
                  <Line yAxisId="current" type="monotone" dataKey="current" stroke="#f59e0b" strokeWidth={2} name="Current Draw (A)" />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Battery</p>
                  <p className="text-xl font-bold">{powerAnalysis.avgBattery?.toFixed(1) || 'N/A'}V</p>
                  <p className="text-xs text-muted-foreground">Min: {powerAnalysis.minBattery?.toFixed(1) || 'N/A'}V</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Current Draw</p>
                  <p className="text-xl font-bold">{powerAnalysis.avgCurrent?.toFixed(1) || 'N/A'}A</p>
                  <p className="text-xs text-muted-foreground">Peak: {powerAnalysis.maxCurrent?.toFixed(1) || 'N/A'}A</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Alarms */}
        {alarmAnalysis.topAlarms.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Alarms by Frequency</CardTitle>
              <CardDescription>Most common alarm codes and their severity distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alarmAnalysis.topAlarms.map((alarm, i) => (
                  <div key={alarm.code} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alarm.code}</p>
                        <div className="flex gap-1 mt-1">
                          {alarm.severity.critical > 0 && (
                            <Badge variant="destructive" className="text-xs h-4 px-1">
                              {alarm.severity.critical} Critical
                            </Badge>
                          )}
                          {alarm.severity.minor > 0 && (
                            <Badge className="bg-yellow-500 text-xs h-4 px-1">
                              {alarm.severity.minor} Minor
                            </Badge>
                          )}
                          {alarm.severity.info > 0 && (
                            <Badge variant="secondary" className="text-xs h-4 px-1">
                              {alarm.severity.info} Info
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-bold">{alarm.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* System Performance & Door Status */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Compressor Modes */}
        {Object.keys(systemPerformance.compressorModes).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Compressor Operating Modes</CardTitle>
              <CardDescription>Distribution of compressor operation states</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(systemPerformance.compressorModes).map(([mode, count]) => ({
                      name: mode,
                      value: count
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.keys(systemPerformance.compressorModes).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Discharge Pressure</p>
                  <p className="text-xl font-bold">{systemPerformance.avgDischargePressure?.toFixed(0) || 'N/A'} kPa</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Suction Pressure</p>
                  <p className="text-xl font-bold">{systemPerformance.avgSuctionPressure?.toFixed(0) || 'N/A'} kPa</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Door Status & Atmospheric Control */}
        <Card>
          <CardHeader>
            <CardTitle>System Status Summary</CardTitle>
            <CardDescription>Door events and atmospheric control (if applicable)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Door Status */}
              <div>
                <h4 className="text-sm font-medium mb-2">Door Activity</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-green-500/10 rounded">
                    <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-600" />
                    <p className="text-lg font-bold">{doorAnalysis.closedCount}</p>
                    <p className="text-xs text-muted-foreground">Closed</p>
                  </div>
                  <div className="text-center p-2 bg-red-500/10 rounded">
                    <XCircle className="h-4 w-4 mx-auto mb-1 text-red-600" />
                    <p className="text-lg font-bold">{doorAnalysis.openCount}</p>
                    <p className="text-xs text-muted-foreground">Open</p>
                  </div>
                  <div className="text-center p-2 bg-gray-500/10 rounded">
                    <Activity className="h-4 w-4 mx-auto mb-1 text-gray-600" />
                    <p className="text-lg font-bold">{doorAnalysis.disconnectedCount}</p>
                    <p className="text-xs text-muted-foreground">Disconnected</p>
                  </div>
                </div>
              </div>

              {/* Atmospheric Control */}
              {atmosphericAnalysis.hasAtmosphericControl && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Atmospheric Control</h4>
                  <div className="space-y-2">
                    {atmosphericAnalysis.o2 && (
                      <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="text-sm">O₂ Level</span>
                        <span className="font-mono text-sm">
                          {atmosphericAnalysis.o2.avg.toFixed(1)}% (±{(atmosphericAnalysis.o2.max - atmosphericAnalysis.o2.min).toFixed(1)})
                        </span>
                      </div>
                    )}
                    {atmosphericAnalysis.co2 && (
                      <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="text-sm">CO₂ Level</span>
                        <span className="font-mono text-sm">
                          {atmosphericAnalysis.co2.avg.toFixed(1)}% (±{(atmosphericAnalysis.co2.max - atmosphericAnalysis.co2.min).toFixed(1)})
                        </span>
                      </div>
                    )}
                    {atmosphericAnalysis.humidity && (
                      <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="text-sm">Humidity</span>
                        <span className="font-mono text-sm">
                          {atmosphericAnalysis.humidity.avg.toFixed(1)}% (±{(atmosphericAnalysis.humidity.max - atmosphericAnalysis.humidity.min).toFixed(1)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
