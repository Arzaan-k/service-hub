# Live Fleet Map Implementation

## Overview
The fleet map has been upgraded to display real-time container location updates from Orbcomm IoT devices. The system combines scheduled data updates with real-time WebSocket broadcasting for immediate visibility.

## Features Implemented

### 1. Scheduled Data Updates (Every 15 Minutes)
- **File**: `server/services/dataUpdateScheduler.ts`
- **Functionality**: Runs a cron job every 15 minutes to ensure data consistency
- **Purpose**: Acts as a backup to ensure all container data is up-to-date

### 2. Real-time WebSocket Updates
- **Server**: `server/services/orbcommIntegration.ts`
- **Client**: `client/src/lib/websocket.ts`
- **Functionality**: Broadcasts container updates immediately when Orbcomm alerts are received
- **Data Transmitted**:
  - Container location (latitude/longitude)
  - Temperature readings
  - Power status
  - Alert information
  - Timestamp

### 3. Enhanced Map Components

#### MapMyIndia Fleet Map
- **File**: `client/src/components/dashboard/mapmyindia-fleet-map.tsx`
- **Features**:
  - Real-time marker updates
  - Live temperature and power status display
  - Color-coded markers based on status
  - WebSocket event listeners for instant updates

#### Global Fleet Map
- **File**: `client/src/components/dashboard/global-fleet-map.tsx`
- **Features**:
  - Global container tracking
  - Real-time location updates
  - India and global view modes

## Architecture

```
Orbcomm CDH WebSocket
       ↓
Server (orbcommIntegration.ts)
       ↓
   ┌──────────────────┐
   ↓                  ↓
Database Update    WebSocket Broadcast
       ↓                  ↓
Scheduled Sync      Client Maps (Real-time)
```

## Data Flow

1. **Orbcomm Alert Received** → Server receives telemetry data via CDH WebSocket
2. **Processing** → Alert is processed and telemetry extracted
3. **Database Update** → Container location and status updated in database
4. **Real-time Broadcast** → Update sent to all connected clients via WebSocket
5. **Map Update** → Fleet maps automatically update markers with new positions

## Configuration

### Environment Variables
```bash
# Orbcomm CDH Connection
ORBCOMM_URL=wss://wamc.wamcentral.net:44355/cdh
ORBCOMM_USERNAME=your_username
ORBCOMM_PASSWORD=your_password

# Enable in development mode (optional)
ENABLE_ORBCOMM_DEV=true
```

### Cron Schedule
The data update scheduler runs every 15 minutes using the cron expression:
```
*/15 * * * *
```

To modify the schedule, edit `server/services/dataUpdateScheduler.ts`:
```typescript
this.scheduledTask = cron.schedule('*/15 * * * *', async () => {
  await this.updateContainerData();
});
```

## WebSocket Events

### Client → Server
- `authenticate`: Authenticate the WebSocket connection

### Server → Client
- `container_update`: Real-time container location/status update
- `alert_created`: New alert notification
- `connected`: Connection established
- `disconnected`: Connection lost

## Usage

### Server Startup
The system automatically starts when the server initializes:
```typescript
// In server/index.ts
await startOrbcommIntegration(); // Starts Orbcomm CDH client
startDataUpdateScheduler();      // Starts 15-minute cron job
```

### Client Connection
WebSocket automatically connects on page load:
```typescript
// In client/src/lib/websocket.ts
websocket.connect(); // Auto-connects with reconnection logic
```

### Monitoring Updates
Check the browser console for real-time update logs:
```
🔄 Received container update: { containerId, latitude, longitude, ... }
📡 Broadcasted container update: ...
```

## Testing

### Manual Trigger
To manually trigger a data update:
```typescript
import { getDataUpdateScheduler } from './server/services/dataUpdateScheduler';

const scheduler = getDataUpdateScheduler();
await scheduler.triggerUpdate();
```

### WebSocket Test
Open browser console and check for:
1. `WebSocket connected` - Connection established
2. `WebSocket message received: container_update` - Updates received
3. Map markers should update position in real-time

## Troubleshooting

### No Real-time Updates
1. Check WebSocket connection in browser console
2. Verify Orbcomm CDH integration is running
3. Check server logs for broadcast messages
4. Ensure containers have `orbcommDeviceId` set

### Delayed Updates
- Orbcomm CDH sends telemetry based on device configuration
- Scheduled updates run every 15 minutes as backup
- Check network connectivity between server and Orbcomm CDH

### Map Not Updating
1. Verify containers have location data (lat/lng)
2. Check container ID matches between Orbcomm and database
3. Review browser console for WebSocket errors
4. Ensure map component is properly mounted

## Performance Considerations

- **WebSocket Auto-reconnect**: Automatically reconnects with exponential backoff
- **Efficient Broadcasting**: Only sends updates to authenticated clients
- **Marker Clustering**: Fleet maps use marker clustering for performance
- **Batch Updates**: Scheduled job processes all containers efficiently

## Future Enhancements

- [ ] Historical location tracking and playback
- [ ] Geofencing alerts
- [ ] Route optimization
- [ ] Predictive maintenance based on location patterns
- [ ] Custom update intervals per container type
