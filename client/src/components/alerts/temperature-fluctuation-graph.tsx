import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { Thermometer } from 'lucide-react';

interface TemperatureFluctuationGraphProps {
  alerts: any[];
  containers: any[];
}

export function TemperatureFluctuationGraph({ alerts, containers }: TemperatureFluctuationGraphProps) {
  const temperatureData = useMemo(() => {
    // Extract temperature readings from alerts over time
    const dataPoints: { [timestamp: string]: { timestamp: string; avgTemp: number; minTemp: number; maxTemp: number; count: number } } = {};

    alerts.forEach(alert => {
      let temperature: number | null = null;
      let timestamp: string | null = null;

      // Extract temperature from various sources in rawData
      if (alert.rawData?.Event?.ReeferData?.TAmb !== undefined) {
        temperature = alert.rawData.Event.ReeferData.TAmb;
      } else if (alert.rawData?.Event?.ReeferData?.TRtn1 !== undefined) {
        temperature = alert.rawData.Event.ReeferData.TRtn1;
      } else if (alert.rawData?.Event?.ReeferData?.TSup1 !== undefined) {
        temperature = alert.rawData.Event.ReeferData.TSup1;
      } else if (alert.rawData?.temperature !== undefined) {
        temperature = alert.rawData.temperature;
      }

      // Get timestamp
      if (alert.rawData?.Event?.MessageData?.EventDtm) {
        timestamp = alert.rawData.Event.MessageData.EventDtm;
      } else if (alert.rawData?.timestamp) {
        timestamp = alert.rawData.timestamp;
      } else if (alert.createdAt) {
        timestamp = alert.createdAt;
      }

      if (temperature !== null && timestamp) {
        // Round timestamp to nearest hour for grouping
        const date = new Date(timestamp);
        const hourKey = format(date, 'yyyy-MM-dd HH:00');

        if (!dataPoints[hourKey]) {
          dataPoints[hourKey] = {
            timestamp: hourKey,
            avgTemp: temperature,
            minTemp: temperature,
            maxTemp: temperature,
            count: 1
          };
        } else {
          const dp = dataPoints[hourKey];
          dp.avgTemp = (dp.avgTemp * dp.count + temperature) / (dp.count + 1);
          dp.minTemp = Math.min(dp.minTemp, temperature);
          dp.maxTemp = Math.max(dp.maxTemp, temperature);
          dp.count += 1;
        }
      }
    });

    // Convert to array and sort by timestamp
    return Object.values(dataPoints)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-48) // Last 48 hours
      .map(dp => ({
        time: format(new Date(dp.timestamp), 'MM/dd HH:mm'),
        avgTemp: parseFloat(dp.avgTemp.toFixed(1)),
        minTemp: parseFloat(dp.minTemp.toFixed(1)),
        maxTemp: parseFloat(dp.maxTemp.toFixed(1)),
        fluctuation: parseFloat((dp.maxTemp - dp.minTemp).toFixed(1))
      }));
  }, [alerts]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (temperatureData.length === 0) return null;

    const allTemps = temperatureData.map(d => d.avgTemp);
    const allFluctuations = temperatureData.map(d => d.fluctuation);

    return {
      avgTemp: (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1),
      minTemp: Math.min(...allTemps).toFixed(1),
      maxTemp: Math.max(...allTemps).toFixed(1),
      avgFluctuation: (allFluctuations.reduce((a, b) => a + b, 0) / allFluctuations.length).toFixed(1),
      maxFluctuation: Math.max(...allFluctuations).toFixed(1)
    };
  }, [temperatureData]);

  if (temperatureData.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Temperature Fluctuation Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No temperature data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Temperature Fluctuation Analysis</CardTitle>
          </div>
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Avg Temp</div>
                <div className="font-semibold">{stats.avgTemp}°C</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Range</div>
                <div className="font-semibold">{stats.minTemp}°C - {stats.maxTemp}°C</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Avg Fluctuation</div>
                <div className="font-semibold">{stats.avgFluctuation}°C</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Max Fluctuation</div>
                <div className="font-semibold text-orange-600">{stats.maxFluctuation}°C</div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={temperatureData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              formatter={(value: number) => [`${value}°C`, '']}
            />
            <Legend />

            {/* Reference lines for critical thresholds */}
            <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Critical Low', fontSize: 10, fill: '#ef4444' }} />
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Critical High', fontSize: 10, fill: '#ef4444' }} />

            {/* Temperature range area */}
            <Line
              type="monotone"
              dataKey="maxTemp"
              stroke="#f97316"
              strokeWidth={1}
              dot={false}
              name="Max Temp"
              strokeOpacity={0.5}
            />
            <Line
              type="monotone"
              dataKey="avgTemp"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }}
              name="Avg Temp"
            />
            <Line
              type="monotone"
              dataKey="minTemp"
              stroke="#06b6d4"
              strokeWidth={1}
              dot={false}
              name="Min Temp"
              strokeOpacity={0.5}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>Showing temperature fluctuations over the last 48 hours. Data points are averaged per hour.</p>
          <p className="mt-1">High fluctuation indicates unstable temperature control.</p>
        </div>
      </CardContent>
    </Card>
  );
}
