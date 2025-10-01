// Mock Orbcomm API integration
// In production, this would connect to actual Orbcomm IoT API

export interface OrbcommDeviceData {
  deviceId: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
  temperature?: number;
  doorStatus?: "open" | "closed";
  powerStatus?: "on" | "off";
  batteryLevel?: number;
  errorCodes?: string[];
}

// Simulated IoT data for development
const MOCK_LOCATIONS = [
  { lat: 33.7434, lng: -118.2726, name: "LA Port" },
  { lat: 32.7157, lng: -117.1611, name: "San Diego" },
  { lat: 37.8044, lng: -122.2712, name: "Oakland" },
  { lat: 33.7701, lng: -118.1937, name: "Long Beach" },
  { lat: 37.7749, lng: -122.4194, name: "San Francisco" },
];

export async function fetchOrbcommDeviceData(deviceId: string): Promise<OrbcommDeviceData> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Generate realistic mock data
  const location = MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)];
  const hasError = Math.random() < 0.15; // 15% chance of error

  return {
    deviceId,
    timestamp: new Date().toISOString(),
    location: {
      latitude: location.lat + (Math.random() - 0.5) * 0.01,
      longitude: location.lng + (Math.random() - 0.5) * 0.01,
    },
    temperature: Math.floor(Math.random() * 30) - 10, // -10 to 20°C
    doorStatus: Math.random() > 0.95 ? "open" : "closed",
    powerStatus: Math.random() > 0.98 ? "off" : "on",
    batteryLevel: Math.floor(Math.random() * 40) + 60, // 60-100%
    errorCodes: hasError ? [`ERR_${Math.floor(Math.random() * 1000)}`] : [],
  };
}

export async function fetchAllDevicesData(deviceIds: string[]): Promise<OrbcommDeviceData[]> {
  const promises = deviceIds.map((id) => fetchOrbcommDeviceData(id));
  return Promise.all(promises);
}

export function detectAnomalies(data: OrbcommDeviceData): string[] {
  const anomalies: string[] = [];

  if (data.powerStatus === "off") {
    anomalies.push("POWER_FAILURE");
  }

  if (data.batteryLevel && data.batteryLevel < 20) {
    anomalies.push("LOW_BATTERY");
  }

  if (data.temperature && (data.temperature < -20 || data.temperature > 30)) {
    anomalies.push("TEMPERATURE_ANOMALY");
  }

  if (data.doorStatus === "open") {
    anomalies.push("DOOR_OPEN_ALERT");
  }

  if (data.errorCodes && data.errorCodes.length > 0) {
    anomalies.push(...data.errorCodes);
  }

  return anomalies;
}
