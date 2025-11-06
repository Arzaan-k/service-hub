#!/usr/bin/env node

// Script to fetch all ORBCOMM data and save to CSV
// This script calls the ORBCOMM API endpoints and exports data to CSV format

console.log('🔧 Script loaded, checking if main module...');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📂 __filename:', __filename);
console.log('📂 process.argv[1]:', process.argv[1]);
console.log('📂 import.meta.url:', import.meta.url);

async function fetchOrbcommData(options = {}) {
  console.log('🚀 Starting ORBCOMM data fetch...');

  const API_BASE = 'http://localhost:5000';
  console.log('📍 API Base URL:', API_BASE);

  // Authenticate first to get token
  let authToken = null;
  try {
    console.log('🔐 Authenticating with server...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@containergenie.com',
        password: 'admin123'
      })
    });

    const loginText = await loginResponse.text();
    console.log('🔐 Login response status:', loginResponse.status);
    console.log('🔐 Login response body:', loginText);

    if (loginResponse.ok) {
      const loginData = JSON.parse(loginText);
      authToken = loginData.token;
      console.log('✅ Authentication successful');
    } else {
      console.log('⚠️ Authentication failed, proceeding without token');
      // Use the token from the create-admin-user script as fallback
      authToken = 'a3b01ecb-d4af-4776-9c7d-ad98ac28cefe';
      console.log('🔧 Using fallback token');
    }
  } catch (error) {
    console.log('⚠️ Authentication error:', error.message);
    // Use fallback token
    authToken = 'a3b01ecb-d4af-4776-9c7d-ad98ac28cefe';
    console.log('🔧 Using fallback token');
  }

  try {
    // Step 1: Check ORBCOMM connection status
    console.log('📡 Checking ORBCOMM connection status...');
    const statusResponse = await fetch(`${API_BASE}/api/orbcomm/real-status`);
    const status = await statusResponse.json();

    console.log('📊 Connection Status:', {
      connected: status.connection?.connected,
      url: status.connection?.url,
      dataSource: status.connection?.dataSource,
      alerts: status.alerts?.total
    });

    if (!status.connection?.connected) {
      console.log('⚠️ ORBCOMM is not connected. Proceeding with available data...');
    }

    // Step 2: Fetch all available ORBCOMM data comprehensively
    console.log('📡 Fetching comprehensive ORBCOMM data...');

    // Get ALL device list (all ORBCOMM devices, not just those with telemetry)
    console.log('📱 Fetching ALL ORBCOMM devices...');
    const devicesResponse = await fetch(`${API_BASE}/api/orbcomm/all-devices`);
    let devices = [];
    if (devicesResponse.ok) {
      devices = await devicesResponse.json();
      console.log(`✅ Fetched ${devices.length} total ORBCOMM devices`);
    } else {
      console.log('⚠️ Failed to fetch devices:', devicesResponse.status, devicesResponse.statusText);
      // Fallback to original endpoint
      console.log('🔄 Trying fallback endpoint...');
      const fallbackResponse = await fetch(`${API_BASE}/api/orbcomm/devices`);
      if (fallbackResponse.ok) {
        devices = await fallbackResponse.json();
        console.log(`✅ Fallback: Fetched ${devices.length} real ORBCOMM devices`);
      } else {
        console.log('⚠️ Fallback also failed');
      }
    }

    // Fetch comprehensive ORBCOMM live data (open endpoint - no auth required)
    console.log('📡 Fetching comprehensive ORBCOMM live data...');
    let liveData = [];
    try {
      const liveDataResponse = await fetch(`${API_BASE}/api/orbcomm/live-data-open`);

      if (liveDataResponse.ok) {
        const liveDataResult = await liveDataResponse.json();
        // Extract data from reeferUnits.data and deviceStatus.data
        const reeferData = liveDataResult.reeferUnits?.data || [];
        const deviceData = liveDataResult.deviceStatus?.data || [];
        liveData = [...reeferData, ...deviceData];
        console.log(`✅ Fetched ${liveData.length} live ORBCOMM data records (${reeferData.length} reefer units + ${deviceData.length} device status)`);
      } else {
        console.log('⚠️ Failed to fetch live ORBCOMM data:', liveDataResponse.status, liveDataResponse.statusText);
        // Try the authenticated endpoint as fallback
        console.log('🔄 Trying authenticated endpoint as fallback...');
        const liveDataHeaders = { 'Content-Type': 'application/json' };
        if (authToken) {
          liveDataHeaders['x-user-id'] = authToken;
        }
        const fallbackResponse = await fetch(`${API_BASE}/api/orbcomm/live-data`, {
          headers: liveDataHeaders
        });
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          const reeferData = fallbackResult.reeferUnits?.data || [];
          const deviceData = fallbackResult.deviceStatus?.data || [];
          liveData = [...reeferData, ...deviceData];
          console.log(`✅ Fallback: Fetched ${liveData.length} live ORBCOMM data records`);
        } else {
          console.log('⚠️ Fallback also failed');
        }
      }
    } catch (error) {
      console.log('⚠️ Error fetching live ORBCOMM data:', error.message);
    }

    // Skip database containers - fetching ONLY from ORBCOMM

    // Get detailed data for each device
    const allDeviceData = [];
    if (devices && devices.length > 0) {
      console.log('📡 Fetching detailed data for all devices...');
      for (const device of devices) {
        try {
          console.log(`📱 Fetching data for device: ${device.deviceId}`);
          const deviceDataResponse = await fetch(`${API_BASE}/api/orbcomm/devices/${device.deviceId}`);
          
          if (deviceDataResponse.ok) {
            const deviceData = await deviceDataResponse.json();
            allDeviceData.push({
              ...device,
              detailedData: deviceData
            });
            console.log(`✅ Got detailed data for device: ${device.deviceId}`);
          } else {
            console.log(`⚠️ Failed to get detailed data for device ${device.deviceId}: ${deviceDataResponse.status}`);
            allDeviceData.push(device);
          }
        } catch (error) {
          console.log(`❌ Error fetching data for device ${device.deviceId}:`, error.message);
          allDeviceData.push(device);
        }
      }
    }

    // Try to get raw events, optionally polling for a duration to accumulate more
    const pollDurationSec = Number(options.durationSec || 0);
    const pollIntervalMs = 3000;
    const uniqueEvents = new Map();
    let rawEventsData = [];

    const collectEventsOnce = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/orbcomm/raw-events`);
        if (!resp.ok) {
          console.log('⚠️ Raw events endpoint not available');
          return;
        }
        const result = await resp.json();
        const events = result.events || [];
        let newlyAdded = 0;
        for (const e of events) {
          const eventObj = e.event || e;
          // Create a stable key using deviceId + eventTime + serialized subtype
          const deviceId = e.deviceId || eventObj.deviceId || eventObj.imei || '';
          const messageData = eventObj.MessageData || {};
          const eventTime = messageData.EventDtm || messageData.eventTime || eventObj.timestamp || '';
          const eventClass = eventObj.EventClass || eventObj.eventType || '';
          const key = `${deviceId}|${eventTime}|${eventClass}`;
          if (!uniqueEvents.has(key)) {
            uniqueEvents.set(key, e);
            newlyAdded++;
          }
        }
        console.log(`📡 Raw events fetched: ${events.length}, unique added this round: ${newlyAdded}, total unique: ${uniqueEvents.size}`);
      } catch (err) {
        console.log('⚠️ Raw events endpoint failed:', err.message);
      }
    };

    if (pollDurationSec > 0) {
      console.log(`⏳ Polling raw events for ${pollDurationSec}s (every ${pollIntervalMs}ms)...`);
      const start = Date.now();
      while (Date.now() - start < pollDurationSec * 1000) {
        await collectEventsOnce();
        await new Promise(r => setTimeout(r, pollIntervalMs));
      }
    } else {
      console.log('📡 Attempting single fetch of raw ORBCOMM events...');
      await collectEventsOnce();
    }
    rawEventsData = Array.from(uniqueEvents.values());

    console.log(`📊 Collected data: ${devices.length} ORBCOMM devices, ${liveData.length} live data records, ${allDeviceData.length} device details, ${rawEventsData.length} raw events`);

    // Step 4: Generate CSV data with ORBCOMM-only data
    const csvData = generateCSVData(rawEventsData, allDeviceData, status, [], [], liveData);

    // Step 5: Save to CSV file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `orbcomm-ALL-satellite-data-${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);

    fs.writeFileSync(filepath, csvData);

    console.log(`✅ ORBCOMM data saved to: ${filename}`);
    console.log(`📊 Total records: ${csvData.split('\n').length - 1}`); // Subtract header row

    return {
      success: true,
      filename,
      records: csvData.split('\n').length - 1,
      status: status.connection?.connected ? 'CONNECTED' : 'DISCONNECTED'
    };

  } catch (error) {
    console.error('❌ Error fetching ORBCOMM data:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

function generateCSVData(rawEventsData, devices, status, containers = [], existingData = [], liveData = []) {
  // Only process ORBCOMM data, skip database containers and existing data
  const useContainers = false;
  const useExistingData = false;
  const headers = [
    'timestamp',
    'source',
    'connection_status',
    'device_id',
    'asset_id',
    'container_id',
    'latitude',
    'longitude',
    'temperature',
    'door_status',
    'power_status',
    'battery_level',
    'error_codes',
    'event_type',
    'event_time',
    'oem',
    'reporting_interval',
    'cellular_type',
    'signal_strength',
    'status',
    'raw_data'
  ];

  const rows = [headers.join(',')];

  // Add connection status row
  const connectionRow = [
    new Date().toISOString(),
    'connection_status',
    status.connection?.connected ? 'connected' : 'disconnected',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    JSON.stringify(status).replace(/"/g, '""')
  ];
  rows.push(connectionRow.map(field => `"${field || ''}"`).join(','));

  // Add raw events data (this contains the actual satellite telemetry)
  if (rawEventsData && rawEventsData.length > 0) {
    rawEventsData.forEach(eventItem => {
      const event = eventItem.event || eventItem;
      const deviceId = eventItem.deviceId || event.deviceId;
      
      // Extract data from the raw ORBCOMM event
      const deviceData = event.DeviceData || {};
      const reeferData = event.ReeferData || {};
      const messageData = event.MessageData || {};
      
      // Extract location
      let latitude = deviceData.GPSLatitude || deviceData.latitude;
      let longitude = deviceData.GPSLongitude || deviceData.longitude;
      
      // Extract other fields
      const temperature = reeferData.TAmb || deviceData.DeviceTemp;
      const doorStatus = deviceData.DoorState || deviceData.doorStatus;
      const powerStatus = deviceData.ExtPower ? 'on' : 'off';
      const batteryLevel = deviceData.BatteryVoltage || deviceData.batteryLevel;
      const assetId = deviceData.LastAssetID || reeferData.AssetID || deviceData.assetId;
      
      // Extract error codes
      let errorCodes = '';
      if (reeferData.ReeferAlarms && Array.isArray(reeferData.ReeferAlarms)) {
        errorCodes = reeferData.ReeferAlarms.map(alarm => alarm.RCAlias || `E${alarm.OemAlarm}`).join('; ');
      }
      
      const eventTime = messageData.EventDtm || messageData.eventTime;
      const oem = reeferData.OEM || deviceData.OEM || 'ORBCOMM';
      
      const row = [
        new Date().toISOString(),
        'raw_event',
        status.connection?.connected ? 'connected' : 'disconnected',
        deviceId || '',
        assetId || '',
        assetId || '', // Use assetId as container_id for now
        latitude || '',
        longitude || '',
        temperature || '',
        doorStatus || '',
        powerStatus || '',
        batteryLevel || '',
        errorCodes || '',
        event.EventClass || event.eventType || 'SatelliteData',
        eventTime || '',
        oem || '',
        '',
        deviceData.cellularType || '',
        deviceData.signalStrength || '',
        'active',
        JSON.stringify(event).replace(/"/g, '""')
      ];
      rows.push(row.map(field => `"${field || ''}"`).join(','));
    });
  }

  // Add device data as additional context
  if (devices && devices.length > 0) {
    devices.forEach(device => {
      const row = [
        new Date().toISOString(),
        'device_list',
        status.connection?.connected ? 'connected' : 'disconnected',
        device.deviceId || device.id || device.imei,
        device.assetId || '',
        '',
        device.location?.latitude || device.location?.lat,
        device.location?.longitude || device.location?.lng,
        device.temperature || '',
        device.doorStatus || '',
        device.powerStatus || '',
        device.batteryLevel || '',
        (device.errorCodes || []).join('; '),
        '',
        device.lastSeen || device.lastUpdate,
        '',
        '',
        '',
        '',
        device.status,
        JSON.stringify(device).replace(/"/g, '""')
      ];
      rows.push(row.map(field => `"${field || ''}"`).join(','));
    });
  }

  // Skip database containers and existing data - ORBCOMM only

  // Add comprehensive live ORBCOMM data
  if (liveData && liveData.length > 0) {
    liveData.forEach(record => {
      const row = [
        new Date().toISOString(),
        'live_orbcomm_data',
        status.connection?.connected ? 'connected' : 'disconnected',
        record.deviceId || record.device_id || record.imei || '',
        record.assetId || record.asset_id || record.containerCode || '',
        record.containerCode || record.assetId || record.asset_id || '',
        record.location?.latitude || record.latitude || record.lat || '',
        record.location?.longitude || record.longitude || record.lng || '',
        record.temperature || record.ambientTemp || '',
        record.doorStatus || record.door_status || '',
        record.powerStatus || record.power_status || '',
        record.batteryLevel || record.battery_level || '',
        (record.errorCodes || record.error_codes || []).join('; ') || '',
        record.eventType || record.event_type || '',
        record.lastUpdate || record.lastSeen || record.last_seen || '',
        record.oem || record.OEM || '',
        '',
        '',
        '',
        record.status || 'active',
        JSON.stringify(record).replace(/"/g, '""')
      ];
      rows.push(row.map(field => `"${field || ''}"`).join(','));
    });
  }

  return rows.join('\n');
}

// Run the script
console.log('🚀 Running ORBCOMM data fetch...');

// Support CLI flag --duration=SECONDS to poll raw events (default 300 seconds for more data)
const durationArg = process.argv.find(a => a.startsWith('--duration='));
const durationSec = durationArg ? Number(durationArg.split('=')[1]) : 300;

fetchOrbcommData({ durationSec })
  .then(result => {
    console.log('\n🎉 ORBCOMM data fetch completed!');
    console.log('Result:', result);

    if (!result.success) {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Make sure the server is running: npm run dev');
      console.log('2. Check server logs for ORBCOMM connection issues');
      console.log('3. Verify ORBCOMM credentials are correct');
      console.log('4. Ensure ORBCOMM API is accessible');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

export { fetchOrbcommData, generateCSVData };
