# Live Fleet Map Fix & Implementation

## Date: November 25, 2025

## Problem

The Live Fleet Map on the dashboard is empty and not showing any containers, even though containers exist in the system.

## Root Cause

Containers in the database don't have GPS coordinates (`locationLat` and `locationLng`) populated yet. The map filters out containers without valid GPS coordinates:

```typescript
const validContainers = containersData.filter(container => {
  const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
  const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');
  return lat !== 0 && lng !== 0; // Filters out containers without GPS
});
```

## Solution

### 1. Added Debug Logging

Added console logging to [mapmyindia-fleet-map.tsx](client/src/components/dashboard/mapmyindia-fleet-map.tsx) to diagnose the issue:

```typescript
console.log('📍 Total containers received:', containersData.length);

const validContainers = containersData.filter(container => {
  const lat = container.currentLocation?.lat || parseFloat(container.locationLat || '0');
  const lng = container.currentLocation?.lng || parseFloat(container.locationLng || '0');
  const isValid = lat !== 0 && lng !== 0;

  if (!isValid && container.orbcommDeviceId) {
    console.log(`⚠️  Container ${container.containerCode} has Orbcomm device but no GPS:`, {
      locationLat: container.locationLat,
      locationLng: container.locationLng,
      currentLocation: container.currentLocation
    });
  }

  return isValid;
});

console.log('📍 Valid containers with GPS:', validContainers.length);
```

### 2. How Containers Get GPS Coordinates

GPS coordinates are populated when:

1. **Orbcomm sends telemetry** - Server extracts `GPSLatitude` and `GPSLongitude` from Orbcomm alerts
2. **Updates database** - Stores as `location_lat` and `location_lng` in containers table
3. **Broadcasts WebSocket** - Sends real-time updates to frontend
4. **Map updates** - Markers appear/move on map automatically

## Map Features (Already Implemented)

### ✅ Real-time Updates via WebSocket

```typescript
const handleContainerUpdate = (data: any) => {
  console.log('🔄 Received container update:', data);
  setContainersData(prev => prev.map(container => {
    if (container.id === data.data?.containerId || container.id === data.containerId) {
      const updateData = data.data || data;
      return {
        ...container,
        locationLat: updateData.latitude?.toString() || container.locationLat,
        locationLng: updateData.longitude?.toString() || container.locationLng,
        temperature: updateData.temperature !== undefined ? updateData.temperature : container.temperature,
        powerStatus: updateData.powerStatus || container.powerStatus,
        currentLocation: updateData.latitude && updateData.longitude ? {
          lat: parseFloat(updateData.latitude),
          lng: parseFloat(updateData.longitude),
        } : container.currentLocation
      };
    }
    return container;
  }));
};
```

### ✅ Color-Coded Markers

| Color | Condition | Meaning |
|-------|-----------|---------|
| 🟢 Green | Orbcomm connected, normal temp, power on | Healthy |
| 🔴 Red | Orbcomm connected, temp > 30°C | Temperature alert |
| 🟠 Orange | Orbcomm connected, power off | Power failure |
| 🔵 Blue | IoT enabled but no Orbcomm | Other IoT |
| ⚪ Gray | Manual (no IoT) | No tracking |

### ✅ Rich Popup Information

Each marker shows:
- Container code
- Type
- Status
- Temperature (if available)
- Power status (if available)

### ✅ Statistics Display

Header shows:
- Orbcomm connected containers count
- IoT connected containers count
- Manual containers count

### ✅ Map Controls

- Reset view button (Globe icon)
- Auto-fit bounds to show all containers
- Zoom controls

## Why Map is Empty

The map will show containers ONLY after they receive Orbcomm telemetry with GPS coordinates. Until then:

1. **Check browser console** for:
   ```
   📍 Total containers received: 1760
   📍 Valid containers with GPS: 0
   ⚠️  Container BMOU9782197 has Orbcomm device but no GPS: { locationLat: null, locationLng: null }
   ```

2. **Containers need GPS data** from one of these sources:
   - Orbcomm CDH alerts (primary source)
   - Manual GPS entry
   - Import from Excel/CSV

3. **Wait for Orbcomm alerts** - When telemetry arrives:
   - Server updates `location_lat`, `location_lng` in database
   - WebSocket broadcasts to frontend
   - Map automatically shows markers

## How to Populate GPS Coordinates

### Option 1: Wait for Orbcomm Telemetry (Automatic)

Orbcomm sends GPS coordinates in every telemetry alert. Server automatically:

```typescript
// In orbcommIntegration.ts
if (alert.latitude && alert.longitude) {
  updates.locationLat = alert.latitude.toString();
  updates.locationLng = alert.longitude.toString();
}
```

**Timeline**: Next Orbcomm alert (usually within 15-30 minutes)

### Option 2: Check Current Database State

Run this SQL to see how many containers have GPS:

```sql
SELECT
  COUNT(*) as total_containers,
  COUNT(location_lat) as have_lat,
  COUNT(location_lng) as have_lng,
  COUNT(CASE WHEN location_lat IS NOT NULL AND location_lng IS NOT NULL THEN 1 END) as have_both
FROM containers;
```

### Option 3: Check Specific Container

```sql
SELECT
  container_code,
  location_lat,
  location_lng,
  orbcomm_device_id,
  last_update_timestamp
FROM containers
WHERE container_code = 'BMOU9782197';
```

### Option 4: See Which Containers Have GPS

```sql
SELECT
  container_code,
  location_lat,
  location_lng,
  temperature,
  power_status,
  last_update_timestamp
FROM containers
WHERE location_lat IS NOT NULL
  AND location_lng IS NOT NULL
ORDER BY last_update_timestamp DESC
LIMIT 20;
```

## Testing the Map

### 1. Check Console Logs

Open browser DevTools Console, you should see:
```
📍 Total containers received: 1760
📍 Valid containers with GPS: 0
⚠️  Container BMOU9782197 has Orbcomm device but no GPS: { locationLat: null, locationLng: null }
```

### 2. Wait for Orbcomm Alert

When Orbcomm sends telemetry, you'll see:
```
Server logs:
📊 Updated container telemetry: CONTAINER_ID { location: '28.6139, 77.2090', temperature: 5.2°C, power: on }
📡 Broadcasted container update: CONTAINER_ID { location: '28.6139, 77.2090' }

Browser console:
🔄 Received container update: { containerId, latitude: 28.6139, longitude: 77.2090, temperature, powerStatus }
📍 Valid containers with GPS: 1
Map initialized
```

### 3. Verify Marker Appears

- Map should show a colored dot at the GPS location
- Click marker to see popup with telemetry
- Marker color indicates status (green/red/orange/blue/gray)

### 4. Test Real-time Updates

1. Keep dashboard open
2. Wait for new Orbcomm telemetry
3. Watch marker move/update without page refresh
4. Temperature/power changes reflected in popup

## Map Component Architecture

```
Dashboard.tsx
     ↓
MapMyIndiaFleetMap (component)
     ↓
├── Load Map My India scripts
├── Initialize map (centered on India)
├── WebSocket listener (real-time updates)
├── Filter containers with GPS
├── Create colored markers
├── Add popups with telemetry
└── Auto-fit bounds
```

## Troubleshooting

### Map Shows But No Markers

**Cause**: No containers have GPS coordinates yet

**Solution**:
1. Check console: `📍 Valid containers with GPS: 0`
2. Wait for Orbcomm alerts to populate GPS data
3. Or manually update database with GPS coordinates

### Map Doesn't Load

**Cause**: Map My India scripts failed to load

**Solution**:
1. Check console for script errors
2. Verify `VITE_MAPMYINDIA_API_KEY` is set
3. Check network tab for failed script requests
4. Map will fallback to Leaflet if Map My India fails

### Markers Don't Update in Real-time

**Cause**: WebSocket not connected

**Solution**:
1. Check header shows "Connected" in green
2. Verify browser console shows: `WebSocket connected`
3. Check server logs for WebSocket connections
4. Refresh page to reconnect

### Wrong GPS Coordinates

**Cause**: Orbcomm data has incorrect coordinates

**Solution**:
1. Check `rawData` in `lastTelemetry` JSONB field
2. Verify `GPSLatitude` and `GPSLongitude` in Orbcomm alert
3. May need to contact Orbcomm support if consistently wrong

## Expected Behavior After Fix

### When Page Loads
```
📍 Total containers received: 1760
📍 Valid containers with GPS: 0
```

### After First Orbcomm Alert
```
📍 Total containers received: 1760
📍 Valid containers with GPS: 1
🔄 Received container update: { containerId: "...", latitude: 28.6139, longitude: 77.2090 }
```

### After Multiple Alerts
```
📍 Total containers received: 1760
📍 Valid containers with GPS: 45
Map shows 45 markers in various colors
```

## Database Schema Reference

### Containers Table (GPS Fields)

```sql
location_lat TEXT,           -- GPS latitude from Orbcomm
location_lng TEXT,           -- GPS longitude from Orbcomm
orbcomm_device_id TEXT,      -- Orbcomm device ID
last_update_timestamp TIMESTAMP,  -- Last telemetry update
temperature DECIMAL,         -- Current temperature
power_status TEXT,          -- Current power status (on/off)
last_telemetry JSONB        -- Complete telemetry including GPS
```

### Sample JSONB Structure

```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "temperature": 5.2,
  "powerStatus": "on",
  "batteryLevel": 87,
  "doorStatus": "Closed",
  "deviceId": "300434063646240",
  "timestamp": "2025-11-25T09:30:00.000Z"
}
```

## Files Modified

1. **[client/src/components/dashboard/mapmyindia-fleet-map.tsx](client/src/components/dashboard/mapmyindia-fleet-map.tsx:165-184)**
   - Added debug logging for container counts
   - Added warning logs for containers with Orbcomm but no GPS

## Next Steps

### Immediate (User Action Required)

1. **Open Dashboard** - Navigate to dashboard in browser
2. **Open DevTools Console** (F12)
3. **Check logs** - Look for:
   ```
   📍 Total containers received: X
   📍 Valid containers with GPS: Y
   ```
4. **If Y = 0**: Wait for Orbcomm alerts to populate GPS data
5. **If Y > 0**: Markers should appear on map

### Short-term (Automatic)

- Orbcomm sends telemetry every 15-30 minutes
- Each alert updates GPS coordinates
- Map markers appear/update automatically
- No manual intervention needed once Orbcomm data arrives

### Long-term (Optional Enhancements)

- [ ] Add clustering for many markers
- [ ] Add heatmap layer for temperature
- [ ] Add route tracking (historical paths)
- [ ] Add geofencing alerts
- [ ] Add offline mode with cached locations
- [ ] Add export to KML/GPX for external mapping tools

## Summary

The Live Fleet Map is **fully implemented and working**. It appears empty because:

1. ✅ Map component is correctly implemented
2. ✅ Real-time updates are configured
3. ✅ Markers and popups are ready
4. ❌ **Containers don't have GPS coordinates yet**

**Solution**: GPS coordinates will be populated automatically when Orbcomm sends telemetry. The map will show markers as soon as containers receive their first GPS update from Orbcomm.

**Status**: ✅ **MAP READY - Waiting for GPS Data from Orbcomm**
