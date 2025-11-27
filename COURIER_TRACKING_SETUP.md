# 🚀 Courier Tracking - Quick Setup Guide

## ✅ Authentication Issue - FIXED!

The 401 Unauthorized error has been fixed. All API calls now use proper authentication.

---

## 💰 Best API for Your Needs (100 shipments/month)

### **TrackingMore API** - RECOMMENDED ✅

**Perfect for your use case:**
- ✅ **FREE**: 50 shipments/month included
- ✅ **Affordable**: Additional shipments only $0.04 each
- ✅ **For 100 shipments/month**: $2/month (50 free + 50 × $0.04)
- ✅ **1,300+ carriers** including all major Indian couriers
- ✅ **Auto-detection** of courier from AWB number
- ✅ **Real-time updates** via webhooks (optional)

**Indian Couriers Supported:**
- Delhivery ✅
- BlueDart ✅
- DTDC ✅
- Xpressbees ✅
- DHL India ✅
- FedEx India ✅
- India Post ✅
- Ecom Express ✅
- Shadowfax ✅
- Gati ✅
- And 1,290+ more worldwide

---

## 🔧 Setup Instructions

### Step 1: Get TrackingMore API Key (FREE)

1. Visit: **https://www.trackingmore.com/api-pricing.html**
2. Click **"Sign Up"**
3. Verify your email
4. Go to **"Developer" → "API Key"**
5. Copy your API key

**Time needed**: 2 minutes
**Cost**: $0 (Free tier)

### Step 2: Add API Key to Environment

Add to your `.env` file:

```env
TRACKINGMORE_API_KEY=your_api_key_here
```

**Important**: Replace `your_api_key_here` with your actual API key from Step 1.

### Step 3: Run Database Migration

```bash
# If not already done
psql -U your_user -d your_database -f migrations/add_courier_shipments.sql
```

### Step 4: Restart Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 5: Test It!

1. Go to any Service Request detail page
2. Click **"Courier Tracking"** tab
3. Click **"Add Shipment"**
4. Enter AWB number (e.g., try a real tracking number)
5. Enter courier name (e.g., "Delhivery")
6. Submit
7. Watch it auto-detect and track! 🎉

---

## 💡 Usage Without API Key

**Mock Mode Available:**
- System works without API key for testing
- Shows realistic mock tracking data
- Perfect for demos and development
- Zero cost

To use mock mode: Simply don't add `TRACKINGMORE_API_KEY` to `.env`

---

## 📊 Cost Breakdown

### Scenario 1: 50 shipments/month
**Cost**: **$0/month** (Free tier)

### Scenario 2: 100 shipments/month
**Cost**: **$2/month**
- 50 free shipments
- 50 additional × $0.04 = $2.00
- **Total: $2/month**

### Scenario 3: 150 shipments/month
**Cost**: **$4/month**
- 50 free shipments
- 100 additional × $0.04 = $4.00
- **Total: $4/month**

**Much cheaper than alternatives!**

---

## 🆚 API Comparison

| API | Free Tier | Additional Cost | Indian Carriers |
|-----|-----------|----------------|-----------------|
| **TrackingMore** ✅ | 50/month | $0.04 each | 1,300+ |
| Ship24 | 100 calls | Pay-per-call | 1,500+ |
| AfterShip | 10/month | $9/mo for 100 | 1,100+ |
| ClickPost | 0 | Contact sales | 350+ |

**Winner**: TrackingMore for 100 shipments/month

---

## 📝 How to Use

### Add Shipment

1. Open Service Request
2. Go to "Courier Tracking" tab
3. Click "Add Shipment"
4. Fill in:
   - **AWB Number**: The tracking number (required)
   - **Courier Name**: E.g., "Delhivery" (required)
   - **Description**: What you're shipping (optional)
   - **Origin/Destination**: Locations (optional)
5. Submit

### Refresh Tracking

- Click **"Refresh"** button on any shipment
- Gets latest status from courier
- Updates tracking history

### View History

- Scroll down in shipment card
- See complete tracking timeline
- Checkpoints with locations and timestamps

---

## 🎯 API Features

### Auto-Detection
TrackingMore automatically detects the courier from AWB number:
```typescript
// Just provide AWB number
trackShipment("AWB123456789")

// API figures out it's Delhivery automatically
// Result: { courierName: "Delhivery", courierCode: "delhivery", ... }
```

### Real-Time Updates (Optional)
Set up webhooks to get notified when status changes:
1. Configure webhook URL in TrackingMore dashboard
2. Receive POST requests on status updates
3. No need to refresh manually

### Batch Tracking
Track multiple shipments at once:
```typescript
trackMultipleShipments(["AWB001", "AWB002", "AWB003"])
```

---

## 🐛 Troubleshooting

### Error: 401 Unauthorized
**Status**: ✅ FIXED
**Solution**: Updated to use authenticated API requests

### Error: "Tracking failed"
**Possible causes**:
1. Invalid AWB number
2. Courier not in system yet
3. API key expired

**Solution**:
1. Double-check AWB number
2. Verify courier name spelling
3. Check API key is valid

### No tracking data shown
**Cause**: Shipment not in courier system yet
**Solution**: Wait a few hours after booking, then refresh

---

## 📞 Support

### TrackingMore Support
- **Email**: service@trackingmore.com
- **Documentation**: https://www.trackingmore.com/api-doc.html
- **Response time**: 24-48 hours

### API Status
- **Status Page**: https://status.trackingmore.com (check for outages)

---

## 🔐 Security

✅ **API Key Storage**: Stored in `.env` (not in code)
✅ **Authentication**: All requests authenticated
✅ **HTTPS Only**: Secure API communication
✅ **Rate Limiting**: Automatic retry on limits

---

## 📈 Monitoring Usage

### Check Your Usage

1. Login to TrackingMore dashboard
2. Go to **"Usage Statistics"**
3. See:
   - Total API calls this month
   - Remaining free calls
   - Cost so far

### Set Up Alerts

1. Go to **"Notifications"**
2. Enable **"Usage Alert"**
3. Get email at 80% of free tier

---

## 🎓 Pro Tips

### Tip 1: Batch Operations
Add multiple shipments at once instead of one-by-one

### Tip 2: Auto-Refresh
Refresh tracking before calling technician to ensure latest status

### Tip 3: Description Field
Always add description (e.g., "Compressor motor") for easy identification

### Tip 4: Track Early
Add AWB immediately after booking courier, not later

---

## ✅ Checklist

Before using in production:

- [ ] Signed up for TrackingMore account
- [ ] Added API key to `.env`
- [ ] Ran database migration
- [ ] Tested with real AWB number
- [ ] Verified tracking data appears
- [ ] Set up usage alerts (optional)

---

## 📚 Resources

**TrackingMore**:
- [Pricing](https://www.trackingmore.com/pricing)
- [API Documentation](https://www.trackingmore.com/api-doc.html)
- [Supported Couriers](https://www.trackingmore.com/india-api-couriers.html)

**Alternatives Research**:
- [Ship24 Tracking API](https://www.ship24.com/tracking-api)
- [India Post Tracking API](https://www.trackingmore.com/india-post-tracking-api)
- [GitHub Open Source Option](https://github.com/rajatdhoot123/indian-courier-api)

---

**Setup Time**: 5 minutes
**Monthly Cost**: $2 for 100 shipments
**Supported Couriers**: 1,300+
**Status**: ✅ Ready to Use

🎉 **Happy Tracking!**
