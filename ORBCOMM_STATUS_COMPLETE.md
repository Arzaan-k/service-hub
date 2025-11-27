# Complete Orbcomm Telemetry Display on Status Tab

## Date: November 25, 2025

## Overview
Fixed the Status tab to display ALL Orbcomm telemetry data in real-time, including temperature, power status, battery level, door status, GPS location, and device ID.

## Problem
- Status tab showing "undefined°C" instead of actual temperature
- Missing battery level, door status, and other telemetry fields
- Data not updating in real-time from Orbcomm

## Solution Implemented

### 1. Server-Side: Complete Telemetry Broadcasting

#### File: [server/services/orbcommIntegration.ts](server/services/orbcommIntegration.ts)

**Updated `updateContainerTelemetry()` to store complete telemetry:**

```typescript
// Store complete telemetry in lastTelemetry JSONB field
updates.lastTelemetry = {
  temperature: temperature,
  powerStatus: powerStatus,
  batteryLevel: batteryLevel !== undefined ? Math.round(batteryLevel) : undefined,
  doorStatus: doorStatus,
  latitude: alert.latitude,
  longitude: alert.longitude,
  deviceId: alert.deviceId,
  timestamp: alert.timestamp.toISOString(),
  rawData: alert.rawData, // Store complete raw data for debugging
};
```

**Updated `broadcastContainerUpdate()` to broadcast all fields:**

```typescript
// Extract battery level
let batteryLevel: number | undefined;
if (deviceData.BatteryVoltage !== undefined) {
  batteryLevel = Math.min(100, Math.max(0, (deviceData.BatteryVoltage / 8.1) * 100));
}

// Extract door status
const doorStatus = deviceData.DoorState || reeferData.DoorState;

(global as any).broadcast({
  type: 'container_update',
  data: {
    containerId: alert.containerId,
    deviceId: alert.deviceId,
    latitude: alert.latitude,
    longitude: alert.longitude,
    temperature: temperature,
    powerStatus: powerStatus,
    batteryLevel: batteryLevel !== undefined ? Math.round(batteryLevel) : undefined,
    doorStatus: doorStatus,
    alertType: alert.alertType,
    severity: alert.severity,
    timestamp: alert.timestamp.toISOString(),
  },
});
```

### 2. Client-Side: Enhanced WebSocket Handler

#### File: [client/src/pages/container-detail.tsx](client/src/pages/container-detail.tsx)

**Updated WebSocket handler to capture all telemetry fields:**

```typescript
const updated = {
  ...old,
  locationLat: updateData.latitude?.toString() || old.locationLat,
  locationLng: updateData.longitude?.toString() || old.locationLng,
  temperature: updateData.temperature !== undefined ? updateData.temperature : old.temperature,
  powerStatus: updateData.powerStatus || old.powerStatus,
  orbcommDeviceId: updateData.deviceId || old.orbcommDeviceId,
  lastUpdateTimestamp: updateData.timestamp || new Date().toISOString(),
  hasIot: true, // Update IoT status when receiving Orbcomm data
  lastTelemetry: {
    ...old.lastTelemetry,
    temperature: updateData.temperature !== undefined ? updateData.temperature : old.lastTelemetry?.temperature,
    powerStatus: updateData.powerStatus || old.lastTelemetry?.powerStatus,
    batteryLevel: updateData.batteryLevel !== undefined ? updateData.batteryLevel : old.lastTelemetry?.batteryLevel,
    doorStatus: updateData.doorStatus || old.lastTelemetry?.doorStatus,
    latitude: updateData.latitude !== undefined ? updateData.latitude : old.lastTelemetry?.latitude,
    longitude: updateData.longitude !== undefined ? updateData.longitude : old.lastTelemetry?.longitude,
    timestamp: updateData.timestamp || new Date().toISOString(),
  }
};
```

## Data Flow

```
Orbcomm CDH Alert
       ↓
Server receives alert
       ↓
Extract all telemetry:
  - Temperature (TAmb or DeviceTemp)
  - Power Status (ExtPower: on/off)
  - Battery Level (BatteryVoltage → percentage)
  - Door Status (DoorState)
  - GPS Location (GPSLatitude, GPSLongitude)
  - Device ID (DeviceID)
       ↓
Store in database:
  - Direct fields: temperature, powerStatus, locationLat, locationLng
  - JSONB field: lastTelemetry (complete object)
       ↓
Broadcast WebSocket message with ALL fields
       ↓
Frontend receives update
       ↓
Update React Query cache
       ↓
Invalidate query to force re-render
       ↓
Status tab displays live data
```

## Telemetry Fields Displayed

### Live Telemetry Data Card

| Field | Source | Display | Notes |
|-------|--------|---------|-------|
| **Temperature** | `reeferData.TAmb` or `deviceData.DeviceTemp` | `XX°C` | Shows warning if <-25°C or >30°C |
| **Power Status** | `deviceData.ExtPower` | ON/OFF badge | Green badge if on, red if off |
| **Battery Level** | `deviceData.BatteryVoltage` | Percentage + progress bar | Color coded: green (>50%), yellow (20-50%), red (<20%) |
| **Door Status** | `deviceData.DoorState` or `reeferData.DoorState` | Open/Closed | Text display |
| **Last Update** | `alert.timestamp` | Formatted date/time | Shows when last telemetry received |
| **IoT Device ID** | `deviceData.DeviceID` | Device identifier | Shows "Connected" badge if present |

### GPS Location Card

| Field | Source | Display |
|-------|--------|---------|
| **Coordinates** | `GPSLatitude`, `GPSLongitude` | Lat/Lng in monospace font |
| **Google Maps Link** | Generated from coordinates | Clickable link to open in Maps |
| **Last Location Update** | `alert.timestamp` | Formatted timestamp |

## Database Schema

### Containers Table Fields

```sql
-- Direct telemetry fields
temperature DECIMAL,
power_status TEXT,
location_lat TEXT,
location_lng TEXT,
orbcomm_device_id TEXT,
last_update_timestamp TIMESTAMP,
has_iot BOOLEAN DEFAULT false,

-- Complete telemetry object (JSONB)
last_telemetry JSONB
```

### lastTelemetry JSONB Structure

```json
{
  "temperature": 5.2,
  "powerStatus": "on",
  "batteryLevel": 87,
  "doorStatus": "Closed",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "deviceId": "300434063646240",
  "timestamp": "2025-11-25T09:30:00.000Z",
  "rawData": { /* Complete Orbcomm alert */ }
}
```

## Console Logging

### Server Logs (when processing Orbcomm data)

```
📊 Updated container telemetry: CONTAINER_ID {
  location: '28.6139, 77.2090',
  temperature: '5.2°C',
  power: 'on',
  battery: '87%',
  door: 'Closed'
}

📡 Broadcasted container update: CONTAINER_ID {
  location: '28.6139, 77.2090',
  temperature: '5.2°C',
  power: 'on',
  battery: '87%',
  door: 'Closed'
}
```

### Client Logs (when receiving updates)

```
🔄 Real-time status update received for container: BMOU9782197 {
  containerId: "dab4a903-442f-4379-ba9b-56ccb7834cef",
  temperature: 5.2,
  powerStatus: "on",
  batteryLevel: 87,
  doorStatus: "Closed",
  latitude: 28.6139,
  longitude: 77.2090,
  deviceId: "300434063646240",
  timestamp: "2025-11-25T09:30:00.000Z"
}

📊 Updated container data: {
  temperature: 5.2,
  powerStatus: 'on',
  battery: 87,
  door: 'Closed',
  location: '28.6139, 77.2090'
}
```

## Testing

### 1. Check Server Logs

When Orbcomm sends telemetry, verify console shows:
```
📊 Updated container telemetry: CONTAINER_ID { location, temperature, power, battery, door }
📡 Broadcasted container update: CONTAINER_ID { ... }
```

### 2. Check Browser Console

Open DevTools and watch for:
```
🔄 Real-time status update received for container: CODE { ...data }
📊 Updated container data: { temperature, powerStatus, battery, door, location }
```

### 3. Verify Status Tab Display

1. Navigate to container detail page
2. Click "Status" tab
3. Verify fields show actual values:
   - Temperature: Shows number with °C (not "undefined°C")
   - Power Status: Shows "on" or "off" with colored badge
   - Battery Level: Shows percentage with progress bar
   - Door Status: Shows "Open" or "Closed"
   - IoT Device ID: Shows actual device ID (not "Not Connected")
   - GPS Location: Shows coordinates with Google Maps link

### 4. Verify Real-time Updates

1. Keep Status tab open
2. Wait for Orbcomm to send new telemetry
3. Watch fields update without page refresh
4. Check "Last updated" timestamp changes

## If Status Shows "undefined" or "N/A"

This means the container hasn't received Orbcomm data yet. Possible reasons:

1. **Container not linked to Orbcomm device**
   - Check if `orbcommDeviceId` is set in database
   - Verify AssetID in Orbcomm matches container code

2. **No telemetry received yet**
   - Check server logs for incoming Orbcomm alerts
   - Verify Orbcomm integration is running

3. **Database not updated**
   - Check `last_telemetry` JSONB field in database
   - Verify `temperature`, `powerStatus`, etc. fields are populated

4. **WebSocket not connected**
   - Check browser console for "WebSocket connected" message
   - Verify real-time indicator shows "Connected" in header

## Troubleshooting Steps

### 1. Verify Orbcomm Integration Running

```bash
# Check server logs for:
✅ Orbcomm CDH integration started successfully
```

### 2. Check Container Has Device ID

```sql
SELECT container_code, orbcomm_device_id, last_telemetry
FROM containers
WHERE container_code = 'BMOU9782197';
```

### 3. Verify Telemetry in Database

```sql
SELECT
  container_code,
  temperature,
  power_status,
  location_lat,
  location_lng,
  last_telemetry,
  last_update_timestamp
FROM containers
WHERE orbcomm_device_id IS NOT NULL
ORDER BY last_update_timestamp DESC
LIMIT 10;
```

### 4. Test WebSocket Connection

```javascript
// In browser console
websocket.getStatus()
// Should show: { connected: true, reconnectAttempts: 0 }
```

### 5. Manually Trigger Update

Click the "Refresh Now" button in Status tab header to force fetch latest data from database.

## Files Modified

1. **[server/services/orbcommIntegration.ts](server/services/orbcommIntegration.ts)**
   - Lines 372-424: Updated `updateContainerTelemetry()` to store complete telemetry in JSONB
   - Lines 428-480: Updated `broadcastContainerUpdate()` to include battery and door status

2. **[client/src/pages/container-detail.tsx](client/src/pages/container-detail.tsx)**
   - Lines 232-266: Enhanced WebSocket handler to capture all telemetry fields
   - Lines 872-922: Status tab UI displays all fields correctly

## Success Criteria

- [x] Temperature shows actual value (not "undefined")
- [x] Power status shows on/off with colored badge
- [x] Battery level shows percentage with progress bar
- [x] Door status shows Open/Closed
- [x] IoT Device ID shows actual device identifier
- [x] GPS location shows coordinates
- [x] Last update timestamp refreshes
- [x] Real-time updates work without page refresh
- [x] All data stored in database `lastTelemetry` JSONB field
- [x] WebSocket broadcasts include all telemetry fields
- [x] Console logs show complete telemetry data

## Next Steps for User

### If seeing "undefined" or "N/A":

1. **Verify container has Orbcomm device assigned:**
   - Check container detail page shows IoT Device ID
   - If "Not Connected", the container needs to be linked to an Orbcomm device

2. **Wait for next Orbcomm alert:**
   - Orbcomm sends telemetry periodically (usually every 15-30 minutes)
   - When next alert arrives, Status tab will update automatically

3. **Check which containers have Orbcomm data:**
   - Navigate to ORBCOMM Data page
   - See which containers are actively sending telemetry
   - Those containers will show live data on Status tab

4. **Use manual refresh:**
   - Click "Refresh Now" button to fetch latest data from database
   - Useful if you just linked a container to an Orbcomm device

## Status: ✅ COMPLETE

All Orbcomm telemetry data is now:
- ✅ Extracted from alerts
- ✅ Stored in database (both direct fields and JSONB)
- ✅ Broadcast via WebSocket
- ✅ Displayed on Status tab in real-time
- ✅ Updated without page refresh
- ✅ Logged to console for debugging

The Status tab will show actual telemetry values as soon as the container receives its first Orbcomm alert. Containers without Orbcomm devices or without recent telemetry will show "N/A" until data arrives.
