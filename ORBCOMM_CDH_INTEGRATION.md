# Orbcomm CDH WebSocket Integration

## Overview
Complete implementation of Orbcomm CDH (Continuous Data Hub) WebSocket integration for real-time container alert monitoring. The system connects to Orbcomm's production CDH feed, processes alerts, logs them to Excel, and automatically creates service requests for critical alerts.

## Architecture

```
Orbcomm CDH Server (wss://wamc.wamcentral.net:44355/cdh)
           ↓
    WebSocket Client (orbcommClient.ts)
           ↓
    Integration Service (orbcommIntegration.ts)
          ↙  ↓  ↘
     Excel   DB    Service
     Logger  Alert Requests
```

## Components

### 1. WebSocket Client (`server/services/orbcommClient.ts`)
**Purpose**: Handles WebSocket connection, authentication, and message handling

**Key Features**:
- **Authentication**: Basic Auth with production credentials
- **Protocol**: `cdh.orbcomm.com` subprotocol
- **Request Queue**: Prevents Fault Code 2006 (parallel request conflicts)
- **Auto-Reconnect**: Exponential backoff strategy (5s → 60s max)
- **Heartbeat**: Keeps connection alive with 30s ping intervals
- **Error Handling**: Comprehensive error logging and recovery

**Connection Details**:
```typescript
URL: wss://wamc.wamcentral.net:44355/cdh
Protocol: cdh.orbcomm.com
Username: cdhQuadre
Password: P4pD#QU@!D@re
```

**API**:
```typescript
// Start the client
import { startOrbcommClient } from './services/orbcommClient';
await startOrbcommClient((alert) => {
  console.log('Received alert:', alert);
});

// Stop the client
import { stopOrbcommClient } from './services/orbcommClient';
stopOrbcommClient();

// Get client stats
import { getOrbcommClient } from './services/orbcommClient';
const client = getOrbcommClient();
const stats = client?.getStats();
```

**Stats Object**:
```typescript
{
  connected: boolean,
  lastConnectedAt: Date | null,
  totalAlertsReceived: number,
  lastAlertAt: Date | null,
  errors: number,
  reconnectAttempts: number,
  isSubscribed: boolean,
  queueLength: number
}
```

### 2. Excel Logger (`server/services/orbcommLogger.ts`)
**Purpose**: Logs all Orbcomm alerts to Excel files for audit trail and analysis

**Key Features**:
- **Daily Files**: Creates new Excel file per day (e.g., `orbcomm_alerts_2025-11-21.xlsx`)
- **Auto-Load**: Loads existing file if present, creates new if not
- **Write Queue**: Batches writes to prevent file conflicts
- **Structured Data**: Parses alerts into structured columns

**File Location**: `logs/orbcomm/`

**Excel Structure**:
| Column | Description |
|--------|-------------|
| Timestamp | When alert was received |
| Alert ID | Unique alert identifier |
| Device ID | Orbcomm device/container ID |
| Message Type | Type of message |
| Latitude | GPS latitude |
| Longitude | GPS longitude |
| Alert Type | Type of alert (temperature, power, etc.) |
| Severity | Critical, high, medium, low |
| Description | Alert description |
| Raw JSON | Complete raw alert data |

**API**:
```typescript
// Log an alert
import { logOrbcommAlert } from './services/orbcommLogger';
await logOrbcommAlert(alertData);

// Close logger (saves pending writes)
import { closeOrbcommLogger } from './services/orbcommLogger';
await closeOrbcommLogger();
```

### 3. Integration Service (`server/services/orbcommIntegration.ts`)
**Purpose**: Orchestrates alert processing, database storage, and service request creation

**Key Features**:
- **Alert Processing**: Normalizes and enriches alert data
- **Container Matching**: Maps device IDs to containers
- **Auto Service Requests**: Creates service requests for critical alerts
- **Location Updates**: Updates container GPS coordinates
- **Database Storage**: Stores alerts in alerts table

**Workflow**:
1. Receive alert from WebSocket client
2. Log to Excel
3. Parse and normalize alert data
4. Find matching container by device ID
5. Determine if service request should be created
6. Create service request if critical
7. Update container location
8. Store alert in database

**Service Request Creation Rules**:
- **Severity**: Critical or High
- **Alert Types**:
  - temperature_out_of_range
  - power_failure
  - door_open
  - system_error
  - breakdown
  - malfunction

**API**:
```typescript
// Start integration
import { startOrbcommIntegration } from './services/orbcommIntegration';
await startOrbcommIntegration();

// Stop integration
import { stopOrbcommIntegration } from './services/orbcommIntegration';
await stopOrbcommIntegration();

// Get status
import { getOrbcommIntegration } from './services/orbcommIntegration';
const service = getOrbcommIntegration();
const status = service.getStatus();
```

## Installation

### 1. Install Dependencies
```bash
npm install exceljs ws
npm install --save-dev @types/ws
```

### 2. Environment Variables
Add to `.env` or `.env.development`:

```bash
# Enable Orbcomm in development mode
ENABLE_ORBCOMM_DEV=true

# Or force enable regardless of environment
FORCE_ORBCOMM_DEV=true
```

### 3. Start Server
The integration starts automatically when the server starts (if enabled):

```bash
npm run dev
```

## Usage

### Viewing Logs

**Console Output**:
```
🚀 Orbcomm CDH Client initialized
🔌 Starting Orbcomm CDH WebSocket client...
🔗 Connecting to Orbcomm CDH: wss://wamc.wamcentral.net:44355/cdh
✅ Connected to Orbcomm CDH successfully!
📨 Sending subscription request...
✅ Successfully subscribed to Orbcomm CDH alerts!

🔔 ============ NEW ORBCOMM ALERT ============
📅 Received at: 2025-11-21T10:30:45.123Z
📊 Alert data: {
  "type": "alert",
  "data": {
    "deviceId": "300434063804650",
    "alertType": "temperature_out_of_range",
    "severity": "critical",
    "description": "Temperature exceeded threshold"
  }
}
🔔 =========================================
```

**Excel Logs**:
- Location: `logs/orbcomm/orbcomm_alerts_YYYY-MM-DD.xlsx`
- Opens in Excel, Google Sheets, etc.
- Formatted with headers and colors
- Frozen header row for easy scrolling

### API Endpoints

Add these endpoints to `server/routes.ts` for monitoring:

```typescript
// Get Orbcomm connection status
app.get("/api/orbcomm/status", authenticateUser, async (req, res) => {
  const { getOrbcommIntegration } = await import('./services/orbcommIntegration');
  const service = getOrbcommIntegration();
  const status = service.getStatus();
  res.json(status);
});

// Get recent alerts from Excel logs
app.get("/api/orbcomm/alerts/recent", authenticateUser, async (req, res) => {
  const { getOrbcommLogger } = await import('./services/orbcommLogger');
  const logger = getOrbcommLogger();
  const stats = logger.getStats();
  res.json(stats);
});
```

## Troubleshooting

### Issue: WebSocket not connecting

**Solution**:
1. Check internet connectivity
2. Verify credentials are correct
3. Check firewall/proxy settings
4. Review console logs for specific error messages

### Issue: Fault Code 2006 (Response already in progress)

**Solution**:
- Already handled by request queue
- Ensures only one request is processed at a time
- Check console logs for queue status

### Issue: No alerts received

**Solution**:
1. Verify subscription was successful (check logs)
2. Containers may not have active alerts
3. Check device IDs are correctly configured
4. Verify containers have Orbcomm device IDs assigned

### Issue: Excel file not created

**Solution**:
1. Check write permissions for `logs/orbcomm/` directory
2. Verify ExcelJS is installed
3. Check console for error messages
4. Directory is created automatically on first run

### Issue: Service requests not created

**Solution**:
1. Check alert severity (must be critical or high)
2. Verify container has assigned customer
3. Check alert type matches critical types
4. Review console logs for processing errors

## Testing

### Manual Test Script

Create `test-orbcomm-client.ts`:

```typescript
import { startOrbcommClient, stopOrbcommClient } from './server/services/orbcommClient';

async function test() {
  console.log('🧪 Testing Orbcomm CDH client...');

  // Start client
  await startOrbcommClient((alert) => {
    console.log('📨 TEST: Received alert:', JSON.stringify(alert, null, 2));
  });

  // Keep running for 5 minutes
  setTimeout(() => {
    console.log('🛑 TEST: Stopping client...');
    stopOrbcommClient();
    process.exit(0);
  }, 5 * 60 * 1000);
}

test().catch(console.error);
```

Run:
```bash
npx tsx test-orbcomm-client.ts
```

### Expected Test Output

```
🧪 Testing Orbcomm CDH client...
🚀 Orbcomm CDH Client initialized
🔌 Starting Orbcomm CDH WebSocket client...
🔗 Connecting to Orbcomm CDH: wss://wamc.wamcentral.net:44355/cdh
✅ Connected to Orbcomm CDH successfully!
📨 Sending subscription request...
📥 Request queued. Queue length: 1
📤 Sending request: {"action":"subscribe","type":"alert","data":{}}
✅ Successfully subscribed to Orbcomm CDH alerts!

... (wait for alerts) ...

🔔 ============ NEW ORBCOMM ALERT ============
📅 Received at: 2025-11-21T10:30:45.123Z
📊 Alert data: {...}
🔔 =========================================
```

## Monitoring

### Health Checks

```typescript
// Check if connected
const client = getOrbcommClient();
const stats = client?.getStats();

if (stats?.connected && stats?.isSubscribed) {
  console.log('✅ Orbcomm CDH is healthy');
  console.log(`Total alerts received: ${stats.totalAlertsReceived}`);
  console.log(`Last alert: ${stats.lastAlertAt}`);
} else {
  console.log('❌ Orbcomm CDH is not healthy');
  console.log(`Reconnect attempts: ${stats?.reconnectAttempts}`);
}
```

### Metrics to Monitor

- **Connection Status**: `stats.connected`
- **Subscription Status**: `stats.isSubscribed`
- **Alerts Received**: `stats.totalAlertsReceived`
- **Last Alert Time**: `stats.lastAlertAt`
- **Error Count**: `stats.errors`
- **Reconnect Attempts**: `stats.reconnectAttempts`
- **Queue Length**: `stats.queueLength`

## Configuration

### Disable in Development

To disable Orbcomm in development mode:

```bash
# In .env.development
ENABLE_ORBCOMM_DEV=false
```

### Enable in Production

Orbcomm is automatically enabled in production mode:

```bash
# In .env (production)
NODE_ENV=production
```

### Custom Alert Handlers

Add custom processing logic in `orbcommIntegration.ts`:

```typescript
private async handleProcessedAlert(alert: ProcessedAlert): Promise<void> {
  // Your custom logic here
  if (alert.alertType === 'custom_type') {
    // Do something special
  }

  // Call default processing
  await super.handleProcessedAlert(alert);
}
```

## Files Created

1. **`server/services/orbcommClient.ts`** - WebSocket client
2. **`server/services/orbcommLogger.ts`** - Excel logging
3. **`server/services/orbcommIntegration.ts`** - Integration orchestrator
4. **`logs/orbcomm/`** - Excel log files directory
5. **`ORBCOMM_CDH_INTEGRATION.md`** - This documentation

## Dependencies

- **ws**: WebSocket client library
- **exceljs**: Excel file generation
- **@types/ws**: TypeScript types for ws

## Security

- **Credentials**: Stored in code (consider moving to environment variables)
- **Authentication**: Basic Auth over WSS (secure)
- **Authorization**: Alerts processed only if container/customer exists
- **Audit Trail**: All alerts logged to Excel

## Performance

- **Request Queue**: Prevents parallel request errors
- **Batch Writes**: Excel writes are batched to prevent conflicts
- **Async Processing**: Non-blocking alert processing
- **Heartbeat**: 30s intervals keep connection alive
- **Auto-Reconnect**: Exponential backoff prevents server overload

## Support

For issues or questions:

1. Check console logs for error messages
2. Review Excel logs in `logs/orbcomm/`
3. Check connection status via API
4. Test with manual script
5. Review Orbcomm documentation

## Future Enhancements

- [ ] Dashboard for real-time alert monitoring
- [ ] Email notifications for critical alerts
- [ ] WhatsApp integration for alert notifications
- [ ] Alert analytics and trends
- [ ] Custom alert rules engine
- [ ] Multi-tenant alert routing
- [ ] Alert escalation workflows
- [ ] Historical alert reporting

## License

Internal use only - Orbcomm credentials are confidential
