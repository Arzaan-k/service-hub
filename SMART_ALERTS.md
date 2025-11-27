# Smart Alerts System

## Overview
The Smart Alerts system filters Orbcomm telemetry data to only create actionable alerts, reducing noise and alert fatigue. Instead of alerting on every temperature reading or routine telemetry update, we only create alerts for truly critical conditions.

## Problem Solved
**Before Smart Alerts:**
- 775+ alerts created from routine Orbcomm telemetry
- Dashboard flooded with non-actionable alerts
- Hard to identify truly critical issues
- Alert fatigue for users

**After Smart Alerts:**
- Only critical/actionable alerts are created
- Telemetry still updates containers in real-time
- Dashboard shows only what needs attention
- Better signal-to-noise ratio

## Alert Criteria

### ✅ Alerts Created (Critical/Actionable)

| Condition | Severity | Threshold | Reason |
|-----------|----------|-----------|--------|
| **Reefer Equipment Errors** | Critical | Any error code | Equipment malfunction requires immediate service |
| **Critical Temperature** | High | < -30°C or > 35°C | Extreme temperatures threaten cargo |
| **Power Failure** | High | External power off | Critical infrastructure failure |
| **Battery Critical** | High | < 10% | Device about to shut down |

### ⏭️ Alerts Skipped (Monitored Only)

| Condition | Severity | Threshold | Reason |
|-----------|----------|-----------|--------|
| **Temperature Warning** | Medium | -25°C to -30°C or 30°C to 35°C | Still within acceptable range, just monitor |
| **Door Open** | Medium | Door status = Open | Often intentional during loading/unloading |
| **Routine Telemetry** | Low | Regular updates | Normal operation, no action needed |
| **Battery Warning** | Medium | 10% - 20% | Still has capacity, not urgent |

## How It Works

### 1. Alert Processing Flow
```
Orbcomm CDH Alert Received
         ↓
Extract Telemetry Data
(temperature, power, battery, errors, etc.)
         ↓
Evaluate Against Smart Criteria
         ↓
    ┌────────────┴────────────┐
    ↓                         ↓
CRITICAL              NON-CRITICAL
    ↓                         ↓
Create Alert          Skip Alert
    ↓                         ↓
Store in DB          Just Log & Update Container
    ↓                         ↓
Show on Dashboard    Silent Telemetry Update
```

### 2. Code Implementation

**File**: `server/services/orbcommIntegration.ts`

```typescript
// Determine alert type and severity based on telemetry
let shouldCreateAlert = false; // Only create alerts for critical conditions

// Check for critical conditions
if (errorCodes.length > 0) {
  alertType = 'error';
  severity = 'critical';
  description = `Reefer alarms: ${errorCodes.join(', ')}`;
  shouldCreateAlert = true; // Critical: Equipment errors
} else if (temperature && (temperature < -30 || temperature > 35)) {
  // Extreme temperature ranges only
  alertType = 'temperature';
  severity = 'high';
  description = `Temperature critically out of range: ${temperature}°C`;
  shouldCreateAlert = true; // High: Critical temperature
} else if (temperature && (temperature < -25 || temperature > 30)) {
  // Warning range (don't create alert, just log)
  alertType = 'temperature';
  severity = 'medium';
  description = `Temperature warning: ${temperature}°C`;
  shouldCreateAlert = false; // Medium: Just monitor, don't alert
}
// ... more conditions
```

### 3. Telemetry vs Alerts

**All telemetry updates containers in real-time:**
- Location (latitude/longitude)
- Temperature readings
- Power status
- Battery level
- Last update timestamp

**Only critical conditions create dashboard alerts:**
- Equipment errors
- Extreme temperatures
- Power failures
- Critical battery levels

## Benefits

### 1. Reduced Alert Noise
- **Before**: 775 alerts in database
- **After**: Only ~10-20 critical alerts
- **Reduction**: ~95% fewer alerts

### 2. Actionable Information
Every alert on the dashboard requires human attention or action.

### 3. Better User Experience
- Cleaner dashboard
- Focus on what matters
- Less alert fatigue
- Easier to spot critical issues

### 4. Real-time Telemetry Maintained
- Fleet maps still update in real-time
- Container data always current
- No loss of tracking information

## Configuration

### Adjusting Thresholds

To modify alert thresholds, edit `server/services/orbcommIntegration.ts`:

```typescript
// Example: Make temperature alerts more sensitive
else if (temperature && (temperature < -25 || temperature > 30)) {
  // Change to your desired thresholds
  alertType = 'temperature';
  severity = 'high';
  shouldCreateAlert = true;
}
```

### Alert Criteria Customization

Add new alert conditions:

```typescript
// Example: Alert on humidity
else if (humidity && humidity > 90) {
  alertType = 'humidity';
  severity = 'high';
  description = `High humidity: ${humidity}%`;
  shouldCreateAlert = true;
}
```

## Maintenance

### Clearing Old Alerts

To clear all existing Orbcomm alerts:

```bash
npm run clear:orbcomm-alerts
```

This script:
1. Counts existing Orbcomm alerts
2. Clears foreign key references
3. Deletes all Orbcomm alerts
4. Shows remaining alerts by source

**File**: `server/tools/clear-orbcomm-alerts.ts`

### Monitoring Alert Volume

Check server logs for:
```
📊 Telemetry update: temperature - medium (Temperature warning: 32°C)
🔧 Creating alert: error - critical (Reefer alarms: E05, E12)
```

- `📊 Telemetry update` = Skipped alert (monitored only)
- `🔧 Creating alert` = Alert created for dashboard

## Testing

### Test Smart Filtering

1. **Start the server with Orbcomm integration**:
   ```bash
   npm run dev
   ```

2. **Monitor server console** for alert decisions:
   - Look for `📊 Telemetry update` (skipped)
   - Look for `🔧 Creating alert` (created)

3. **Check dashboard**:
   - Should only show critical alerts
   - Fewer than 20 alerts typically

4. **Verify telemetry updates**:
   - Fleet maps should still update in real-time
   - Container locations should be current
   - Temperature/power data visible in map popups

### Simulate Different Scenarios

To test alert filtering, you can temporarily modify thresholds in `orbcommIntegration.ts`:

```typescript
// Temporarily make all temperature readings create alerts
else if (temperature) {
  shouldCreateAlert = true; // Test mode
}
```

## Dashboard Impact

### Before Smart Alerts
```
Active Alerts: 769
├─ 3 CRITICAL
├─ 5 HIGH
├─ 4 MEDIUM
└─ 757 LOW (noise)
```

### After Smart Alerts
```
Active Alerts: 12
├─ 3 CRITICAL
├─ 5 HIGH
└─ 4 MEDIUM
```

All alerts are now actionable!

## Future Enhancements

Potential improvements to the smart alert system:

- [ ] **Machine Learning**: Learn normal patterns per container
- [ ] **Time-based Rules**: Different thresholds for day/night
- [ ] **Container-specific Thresholds**: Customize per product type
- [ ] **Alert Aggregation**: Group related alerts
- [ ] **Auto-resolution**: Close alerts when conditions normalize
- [ ] **Trend Analysis**: Alert on trends, not just absolutes
- [ ] **Geofencing**: Alert based on location changes

## API Changes

### ProcessedAlert Interface

Added `shouldCreateAlert` flag:

```typescript
interface ProcessedAlert {
  alertId: string;
  deviceId?: string;
  containerId?: string;
  alertType: string;
  severity: string;
  description: string;
  latitude?: number;
  longitude?: number;
  timestamp: Date;
  rawData: any;
  shouldCreateAlert?: boolean; // NEW: Smart filter flag
}
```

### handleProcessedAlert Method

Updated to respect smart filter:

```typescript
private async handleProcessedAlert(alert: ProcessedAlert): Promise<void> {
  // Always update container telemetry
  if (alert.containerId) {
    await this.updateContainerTelemetry(alert);
  }

  // SMART ALERTS: Only store if flagged
  if (alert.shouldCreateAlert) {
    console.log(`🔧 Creating alert: ${alert.alertType}`);
    await this.storeAlert(alert);
  } else {
    console.log(`📊 Telemetry update: ${alert.alertType}`);
  }
}
```

## Troubleshooting

### Too Many Alerts Still Showing

1. **Check alert source**:
   ```sql
   SELECT source, COUNT(*) FROM alerts GROUP BY source;
   ```

2. **Clear old alerts**:
   ```bash
   npm run clear:orbcomm-alerts
   ```

3. **Verify thresholds** in `orbcommIntegration.ts`

### Not Enough Alerts

1. **Check thresholds are not too strict**
2. **Review server logs** for skipped alerts
3. **Adjust `shouldCreateAlert` conditions**

### Fleet Map Not Updating

- Smart alerts don't affect real-time telemetry
- Check WebSocket connection in browser console
- Verify containers have `orbcommDeviceId` set

## Summary

The Smart Alerts system dramatically reduces alert noise while maintaining full real-time telemetry tracking. By filtering out routine updates and only alerting on actionable conditions, users can focus on what truly matters: critical equipment issues, extreme temperatures, and power failures.

**Key Principle**: *Alert on exceptions, monitor everything.*
