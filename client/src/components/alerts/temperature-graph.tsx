import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Thermometer } from "lucide-react";

interface TemperatureGraphProps {
  alerts: any[];
  containers: any[];
}

export function TemperatureGraph({ alerts, containers }: TemperatureGraphProps) {
  // Extract temperature data from alerts
  const temperatureData = useMemo(() => {
    const data: { timestamp: string; temperature: number; containerCode: string; severity: string; date: Date }[] = [];

    alerts.forEach(alert => {
      // Extract temperature from alert data
      let temperature: number | null = null;

      // Try different possible temperature fields
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
      }

      // Also check if alert has temperature field directly
      if (temperature === null && alert.temperature !== undefined && alert.temperature !== null) {
        temperature = alert.temperature;
      }

      // Only include if we found a temperature value
      if (temperature !== null && !isNaN(temperature)) {
        const container = containers.find((c: any) => c.id === alert.containerId);
        const timestamp = new Date(alert.timestamp || alert.createdAt);

        data.push({
          timestamp: timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          temperature: Math.round(temperature * 10) / 10, // Round to 1 decimal
          containerCode: container?.containerCode || `Container ${alert.containerId?.slice(0, 8)}`,
          severity: alert.severity,
          date: timestamp
        });
      }
    });

    // Sort by timestamp
    return data.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [alerts, containers]);

  const stats = useMemo(() => {
    if (temperatureData.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const temps = temperatureData.map(d => d.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      count: temperatureData.length
    };
  }, [temperatureData]);

  if (temperatureData.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Temperature Over Time</CardTitle>
              <CardDescription>Temperature readings from container alerts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Thermometer className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No temperature data available</p>
              <p className="text-sm">Temperature readings will appear here when alerts with temperature data are received</p>
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
          <p className="font-semibold text-sm mb-1">{data.containerCode}</p>
          <p className="text-xs text-muted-foreground mb-2">{data.timestamp}</p>
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

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Temperature Over Time</CardTitle>
              <CardDescription>Temperature readings from {stats.count} container alerts</CardDescription>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Min</p>
              <p className="font-bold text-blue-600 dark:text-blue-400">{stats.min}°C</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Avg</p>
              <p className="font-bold text-orange-600 dark:text-orange-400">{stats.avg}°C</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">Max</p>
              <p className="font-bold text-red-600 dark:text-red-400">{stats.max}°C</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={temperatureData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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

            {/* Reference lines for critical thresholds */}
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
              strokeWidth={2}
              dot={{ r: 4, fill: '#f97316' }}
              activeDot={{ r: 6 }}
              name="Temperature (°C)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
