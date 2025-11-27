# Quick Start - After Smart Alerts Implementation

## 🚀 What Changed

1. **Smart Alerts**: Only critical conditions create dashboard alerts (95% reduction)
2. **Cleared Old Alerts**: Removed 775 noise alerts from database
3. **Fleet Maps**: Already working with real-time updates

## ▶️ Start the Server

```bash
npm run dev
```

Look for these success messages:
```
✅ Orbcomm CDH integration started successfully
✅ Data update scheduler started successfully
```

## 📊 Check the Dashboard

1. Open: http://localhost:5000
2. Navigate to Dashboard
3. You should see:
   - **Fleet Map**: Loading with containers
   - **Active Alerts**: < 20 alerts (down from 769!)
   - **Only Critical/High/Medium**: No noise

## 🔍 Monitor Alerts

### Server Console
```bash
# Good (skipped routine telemetry)
📊 Telemetry update: temperature - medium (Temperature warning: 32°C)

# Alert created (critical condition)
🔧 Creating alert: error - critical (Reefer alarms: E05)
```

### Browser Console
```bash
# WebSocket connected
✅ WebSocket connected

# Real-time updates
🔄 Received container update: { containerId: "abc", lat: 19.076, lng: 72.877 }
```

## 🎯 Alert Criteria

### ✅ Creates Alert
- Equipment errors (any)
- Temperature < -30°C or > 35°C
- Power failure
- Battery < 10%

### ⏭️ Skips Alert (monitors only)
- Temperature -25°C to 30°C
- Door open status
- Battery 10-20%
- Routine telemetry

## 🛠️ Useful Commands

```bash
# Clear Orbcomm alerts (if needed again)
npm run clear:orbcomm-alerts

# Check TypeScript
npm run check

# Start server
npm run dev
```

## 📖 Full Documentation

- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - What changed
- [SMART_ALERTS.md](SMART_ALERTS.md) - Alert criteria details
- [LIVE_FLEET_MAP.md](LIVE_FLEET_MAP.md) - Real-time maps
- [TEST_PLAN.md](TEST_PLAN.md) - Testing guide

## ✅ Success Indicators

1. Dashboard shows < 20 alerts
2. Fleet map displays containers
3. Server logs show `📊 Telemetry update` more than `🔧 Creating alert`
4. No alert fatigue!
