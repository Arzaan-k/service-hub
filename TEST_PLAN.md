# Live Fleet Map - Testing Plan

## Implementation Summary

All features have been successfully implemented:

✅ **1. Scheduled Data Updates (Every 15 minutes)**
   - Created `server/services/dataUpdateScheduler.ts`
   - Integrated with server startup in `server/index.ts`
   - Uses node-cron for reliable scheduling

✅ **2. Real-time WebSocket Updates**
   - Enhanced `server/services/orbcommIntegration.ts` with broadcast
   - Created `client/src/lib/websocket.ts` for client-side handling
   - Broadcasts temperature, power status, and location data

✅ **3. Live Fleet Maps**
   - Updated `client/src/components/dashboard/mapmyindia-fleet-map.tsx`
   - Updated `client/src/components/dashboard/global-fleet-map.tsx`
   - Both maps now listen to real-time updates

✅ **4. Documentation**
   - Created `LIVE_FLEET_MAP.md` with full implementation details

## Testing Instructions

### Prerequisites
1. Ensure Orbcomm CDH connection is configured:
   ```bash
   ORBCOMM_URL=wss://wamc.wamcentral.net:44355/cdh
   ORBCOMM_USERNAME=your_username
   ORBCOMM_PASSWORD=your_password
   ```

### Test 1: Server Startup
1. Start the server:
   ```bash
   npm run dev
   ```

2. Check console for these messages:
   - `✅ Orbcomm CDH integration started successfully`
   - `🕒 Starting data update scheduler (every 15 minutes)...`
   - `✅ Data update scheduler started successfully`

### Test 2: WebSocket Connection
1. Open the application in browser
2. Open Developer Console (F12)
3. Look for:
   - `Connecting to WebSocket: ws://localhost:5000/ws`
   - `✅ WebSocket connected`

### Test 3: Real-time Updates
1. Navigate to Dashboard page
2. Open browser console
3. Wait for Orbcomm alerts (or trigger manually)
4. Look for console messages:
   - `🔄 Received container update: ...`
   - Map markers should update position in real-time

### Test 4: Scheduled Updates
1. Wait for 15 minutes (or modify cron schedule to `*/1 * * * *` for 1-minute testing)
2. Check server console for:
   - `🔄 Running scheduled container data update...`
   - `✅ Container data update completed in Xms`
   - `📍 X/Y containers have location data`

### Test 5: Map Marker Updates
1. Open Dashboard
2. Check both map types:
   - MapMyIndia Fleet Map
   - Global Fleet Map
3. Verify markers show:
   - Correct location
   - Color-coded status (green=normal, red=alert, blue=IoT)
   - Temperature in popup (if available)
   - Power status in popup

### Test 6: Alert Broadcasting
1. When an Orbcomm alert is received
2. Check browser console for:
   - `🚨 Received alert: ...`
3. Check server console for:
   - `📡 Broadcasted container update: ...`

## Expected Behavior

### Real-time Updates
- Container locations update within 1-2 seconds of Orbcomm alert
- Map markers animate to new positions
- No page refresh required

### Scheduled Updates
- Runs every 15 minutes automatically
- Updates all containers with Orbcomm devices
- Logs statistics to console

### WebSocket Reliability
- Auto-reconnects if connection drops
- Handles up to 10 reconnection attempts
- Exponential backoff for reconnection

## Troubleshooting

### Issue: No real-time updates
**Check:**
1. WebSocket connection status in browser console
2. Orbcomm CDH integration running on server
3. Containers have `orbcommDeviceId` field set

### Issue: Map markers not updating
**Check:**
1. Browser console for WebSocket messages
2. Container has valid lat/lng coordinates
3. Map component is properly mounted

### Issue: Scheduled updates not running
**Check:**
1. Server console for cron messages
2. `node-cron` package installed
3. Data update scheduler started successfully

## Performance Monitoring

### Server-side
Monitor these logs:
- `🔄 Running scheduled container data update...`
- `✅ Container data update completed in Xms`
- `📡 Broadcasted container update: ...`

### Client-side
Monitor browser console for:
- WebSocket connection status
- Update event frequency
- Map rendering performance

## Next Steps for Production

1. **Enable in Production**
   ```bash
   # In .env
   NODE_ENV=production
   ENABLE_ORBCOMM_DEV=false  # Will auto-enable in production
   ```

2. **Monitor Performance**
   - Track WebSocket message volume
   - Monitor database update frequency
   - Check map rendering performance

3. **Tune Update Frequency**
   - Adjust cron schedule if needed
   - Configure Orbcomm CDH alert frequency
   - Balance real-time vs. resource usage

4. **Add Logging**
   - Consider adding analytics for update events
   - Track alert-to-update latency
   - Monitor WebSocket connection stability
