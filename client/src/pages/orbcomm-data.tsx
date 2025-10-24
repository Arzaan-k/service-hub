import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface OrbcommDevice {
  deviceId: string;
  assetId?: string;
  lastUpdate?: string;
  location?: {
    lat: number;
    lng: number;
  };
  temperature?: number;
  doorStatus?: string;
  powerStatus?: string;
  batteryLevel?: number;
  errorCodes?: string[];
  rawData?: any;
}

interface DeviceData {
  deviceId: string;
  assetId?: string;
  lastUpdate?: string;
  location?: {
    lat: number;
    lng: number;
  };
  temperature?: number;
  doorStatus?: string;
  powerStatus?: string;
  batteryLevel?: number;
  errorCodes?: string[];
  rawData?: any;
}

const OrbcommDataPage: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Fetch all ORBCOMM devices
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useQuery<OrbcommDevice[]>({
    queryKey: ['orbcomm-devices'],
    queryFn: async () => {
      const response = await fetch('/api/orbcomm/devices');
      if (!response.ok) {
        throw new Error('Failed to fetch ORBCOMM devices');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch detailed data for selected device
  const { data: deviceData, isLoading: deviceDataLoading } = useQuery<DeviceData>({
    queryKey: ['orbcomm-device-data', selectedDevice],
    queryFn: async () => {
      if (!selectedDevice) return null;
      const response = await fetch(`/api/orbcomm/devices/${selectedDevice}`);
      if (!response.ok) {
        throw new Error('Failed to fetch device data');
      }
      return response.json();
    },
    enabled: !!selectedDevice,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatLocation = (location?: { lat: number; lng: number }) => {
    if (!location) return 'N/A';
    return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'text-red-600';
      case 'closed': return 'text-green-600';
      case 'on': return 'text-green-600';
      case 'off': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getBatteryColor = (level?: number) => {
    if (!level) return 'text-gray-600';
    if (level > 80) return 'text-green-600';
    if (level > 50) return 'text-yellow-600';
    if (level > 20) return 'text-orange-600';
    return 'text-red-600';
  };

  if (devicesLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (devicesError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading ORBCOMM data</h3>
          <p className="text-red-600 mt-1">
            {devicesError instanceof Error ? devicesError.message : 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ORBCOMM Device Data</h1>
        <p className="text-gray-600 mt-1">
          Real-time data from ORBCOMM CDH WebSocket connection
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Devices ({devices.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {devices.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No devices found
              </div>
            ) : (
              devices.map((device) => (
                <div
                  key={device.deviceId}
                  className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedDevice === device.deviceId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedDevice(device.deviceId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{device.deviceId}</h3>
                      {device.assetId && (
                        <p className="text-sm text-gray-600">Asset: {device.assetId}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {formatTimestamp(device.lastUpdate)}
                      </p>
                      {device.temperature && (
                        <p className="text-sm font-medium">
                          {device.temperature}°C
                        </p>
                      )}
                    </div>
                  </div>
                  {device.location && (
                    <p className="text-xs text-gray-500 mt-1">
                      📍 {formatLocation(device.location)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Device Details */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Device Details
              {selectedDevice && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  - {selectedDevice}
                </span>
              )}
            </h2>
          </div>
          <div className="p-6">
            {!selectedDevice ? (
              <div className="text-center text-gray-500 py-8">
                Select a device to view details
              </div>
            ) : deviceDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : deviceData ? (
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Device ID</label>
                    <p className="text-sm text-gray-900">{deviceData.deviceId}</p>
                  </div>
                  {deviceData.assetId && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Asset ID</label>
                      <p className="text-sm text-gray-900">{deviceData.assetId}</p>
                    </div>
                  )}
                </div>

                {/* Location */}
                {deviceData.location && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <p className="text-sm text-gray-900">{formatLocation(deviceData.location)}</p>
                  </div>
                )}

                {/* Last Update */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Last Update</label>
                  <p className="text-sm text-gray-900">{formatTimestamp(deviceData.lastUpdate)}</p>
                </div>

                {/* Status Indicators */}
                <div className="grid grid-cols-2 gap-4">
                  {deviceData.temperature && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Temperature</label>
                      <p className="text-sm font-medium text-gray-900">{deviceData.temperature}°C</p>
                    </div>
                  )}
                  {deviceData.doorStatus && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Door Status</label>
                      <p className={`text-sm font-medium ${getStatusColor(deviceData.doorStatus)}`}>
                        {deviceData.doorStatus}
                      </p>
                    </div>
                  )}
                  {deviceData.powerStatus && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Power Status</label>
                      <p className={`text-sm font-medium ${getStatusColor(deviceData.powerStatus)}`}>
                        {deviceData.powerStatus}
                      </p>
                    </div>
                  )}
                  {deviceData.batteryLevel && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Battery Level</label>
                      <p className={`text-sm font-medium ${getBatteryColor(deviceData.batteryLevel)}`}>
                        {deviceData.batteryLevel}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Error Codes */}
                {deviceData.errorCodes && deviceData.errorCodes.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Error Codes</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {deviceData.errorCodes.map((code, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Data */}
                {deviceData.rawData && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Raw Data</label>
                    <pre className="text-xs bg-gray-100 p-3 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(deviceData.rawData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No data available for this device
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{devices.length}</div>
            <div className="text-sm text-gray-600">Devices Connected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {devices.filter(d => d.lastUpdate).length}
            </div>
            <div className="text-sm text-gray-600">Active Devices</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {devices.filter(d => d.errorCodes && d.errorCodes.length > 0).length}
            </div>
            <div className="text-sm text-gray-600">Devices with Errors</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrbcommDataPage;
