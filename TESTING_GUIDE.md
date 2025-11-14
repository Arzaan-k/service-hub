# Complete Testing Guide - WhatsApp Bot with Neon DB

## Pre-Testing Checklist

### 1. Verify Database Data
Check your Neon DB has:
- ✅ Users with phone numbers (e.g., `918218994855`)
- ✅ Customers linked to users (`assigned_client_id`)
- ✅ Containers assigned to customers (`current_customer_id`)
- ✅ Service requests (if any exist)

### 2. Verify Environment Variables
Check `.env` file has:
```env
WA_PHONE_NUMBER_ID=737570086113833
CLOUD_API_ACCESS_TOKEN=your_token_here
DATABASE_URL=postgresql://...
```

### 3. Restart Server
```bash
npm run dev
```

## Test Scenario 1: User Identification

### Steps:
1. Send "hi" from WhatsApp number `918218994855`

### Expected Logs:
```
[WhatsApp] Processing message from 918218994855
[WhatsApp] Trying to find user with phone: 8218994855
[WhatsApp] Trying to find user with phone: +918218994855
[WhatsApp] Found existing user: Jawad (f7dd93e7-...), role: client
[WhatsApp] 🔍 Verifying user role from dashboard data...
[WhatsApp] ✅ User identified as CLIENT from dashboard (customer record found)
```

### Expected WhatsApp Response:
```
👋 Welcome to Service Hub!

How can I help you today?

🔧 Request Service
📊 Check Status
```

### ✅ Success Criteria:
- User found in database
- Role detected as "client"
- Menu appears (buttons or text)

### ❌ If Fails:
- Check user exists in `users` table
- Check phone number format matches
- Check customer record exists in `customers` table

## Test Scenario 2: Container Fetching

### Steps:
1. Click "Request Service" button (or type "service")

### Expected Logs:
```
[WhatsApp] handleRealClientRequestService - user: Jawad (f7dd93e7-...)
[WhatsApp] Found customer: Company Name (customer-id)
[WhatsApp] Fetched 3 containers for customer
```

### Expected WhatsApp Response:
```
🔧 Service Request
Which container needs service?

Select a container from the list below.

[Interactive List with containers]
- TRIU6617292 – refrigerated (active, Thane)
- TDRU7152244 – dry (active, Los Angeles)

📍 Container ID Location Reference
[Image showing where to find container ID]
```

### ✅ Success Criteria:
- Customer found in database
- Containers fetched from Neon DB
- Container list shows real data
- Reference image sent

### ❌ If Fails:
- Check customer has `id` in database
- Check containers table has `current_customer_id` matching customer
- Check containers are not deleted/inactive

## Test Scenario 3: Complete Service Request Flow

### Steps:
1. Select container from list
2. Enter error code: `e404`
3. Enter description: `reefer not working`
4. Upload photo
5. Type `DONE`
6. Upload video
7. Type `DONE`

### Expected Logs:
```
[WhatsApp] Container selected: TRIU6617292
[WhatsApp] Stored in conversationState: selectedContainers
[WhatsApp] Error code received: e404
[WhatsApp] Description received: reefer not working
[WhatsApp] Photo uploaded: media-id-123
[WhatsApp] Video uploaded: media-id-456
[WhatsApp] Creating service request...
[WhatsApp] Service request created: SR-1762863688123
```

### Expected WhatsApp Response:
```
✅ Your service request has been raised!

📋 Request Number(s): SR-1762863688123
📸 Photos: 1
🎥 Videos: 1

A technician will contact you soon.

You can check the status anytime by selecting "Status" from the menu.
```

### ✅ Success Criteria:
- Service request created in Neon DB
- Request number generated
- All data saved correctly
- Confirmation message sent

### ❌ If Fails:
- Check `service_requests` table exists
- Check foreign key constraints
- Check `conversationState` preserved in session

## Test Scenario 4: Dashboard Verification

### Steps:
1. Login to dashboard as admin
2. Navigate to Service Requests page
3. Look for newly created request

### Expected Result:
Service request appears with:
- ✅ Request Number: `SR-1762863688123`
- ✅ Status: `pending`
- ✅ Container: `TRIU6617292`
- ✅ Customer: Company name
- ✅ Description: "reefer not working\n\nError Code: e404"
- ✅ Photos: 1
- ✅ Videos: 1
- ✅ Created date/time

### ✅ Success Criteria:
- Request visible in dashboard
- All fields populated correctly
- Can click to view details

### ❌ If Fails - Possible Reasons:

#### Reason 1: User Role Filter
**Problem**: Dashboard only shows requests based on user role
- **Admin**: Shows ALL requests
- **Client**: Shows only their requests
- **Technician**: Shows only assigned requests

**Solution**: Login as admin to see all requests

#### Reason 2: Frontend Filtering
**Problem**: Tab filter hiding requests

**Solution**: Click "All" tab to see all statuses

#### Reason 3: Missing Relationships
**Problem**: Service request has invalid `containerId` or `customerId`

**Solution**: Check Neon DB:
```sql
SELECT * FROM service_requests WHERE request_number = 'SR-1762863688123';
-- Verify containerId and customerId exist in their respective tables
```

#### Reason 4: Frontend Not Refreshing
**Problem**: React Query cache not updated

**Solution**: Hard refresh page (Ctrl+Shift+R)

## Test Scenario 5: Session Persistence

### Steps:
1. Start service request flow
2. Select container
3. Close WhatsApp
4. Reopen WhatsApp
5. Send any message

### Expected Behavior:
- Bot remembers you selected a container
- Continues from where you left off
- Asks for error code (next step)

### Expected Logs:
```
[WhatsApp] Found existing session abc123 for 918218994855
[WhatsApp] conversationState: {
  selectedContainers: ['container-id'],
  customerId: 'customer-id',
  step: 'awaiting_error_code'
}
```

### ✅ Success Criteria:
- Session retrieved successfully
- `conversationState` preserved
- Flow continues correctly

### ❌ If Fails:
- Check `whatsapp_sessions` table
- Verify `conversationState` is JSONB
- Check session not expired

## Common Issues & Solutions

### Issue 1: "No containers selected" Error

**Symptom**: Bot says "No containers selected" after clicking Proceed

**Cause**: Session not persisting, `conversationState` lost

**Solution**: 
- ✅ FIXED in latest code
- Session now retrieved by phone number
- `conversationState` preserved on updates

### Issue 2: Database Enum Error

**Symptom**: Error: `invalid input value for enum whatsapp_recipient_type: "system"`

**Cause**: Code using invalid enum value

**Solution**:
- ✅ FIXED in latest code
- Now uses: 'customer', 'technician', or 'admin'

### Issue 3: Service Requests Not Showing

**Symptom**: Dashboard shows "No service requests found"

**Possible Causes**:
1. **User Role**: Client/Technician sees filtered view
2. **Tab Filter**: Wrong status tab selected
3. **Database**: Requests not actually created
4. **Frontend**: Cache not refreshed

**Solutions**:
1. Login as admin
2. Click "All" tab
3. Check Neon DB directly
4. Hard refresh page

### Issue 4: Bot Not Responding

**Symptom**: Send "hi", no response

**Possible Causes**:
1. **Server Down**: Check if server running
2. **Webhook**: WhatsApp webhook not configured
3. **User Not Found**: Phone number not in database
4. **Credentials**: Invalid WhatsApp API credentials

**Solutions**:
1. Check server logs
2. Verify webhook URL in Meta dashboard
3. Add user to `users` table
4. Check `.env` file

## Database Verification Queries

### Check User Exists:
```sql
SELECT * FROM users WHERE phone_number IN ('918218994855', '+918218994855', '8218994855');
```

### Check Customer Linked:
```sql
SELECT c.* FROM customers c
JOIN users u ON c.assigned_client_id = u.id
WHERE u.phone_number = '918218994855';
```

### Check Containers:
```sql
SELECT * FROM containers WHERE current_customer_id = 'customer-id-here';
```

### Check Service Requests:
```sql
SELECT * FROM service_requests 
WHERE customer_id = 'customer-id-here'
ORDER BY created_at DESC
LIMIT 10;
```

### Check WhatsApp Session:
```sql
SELECT * FROM whatsapp_sessions 
WHERE phone_number = '918218994855'
ORDER BY created_at DESC
LIMIT 1;
```

## Success Indicators

### ✅ Everything Working:
- User sends "hi" → Menu appears
- Click "Request Service" → Container list shows
- Select container → Asks for error code
- Complete flow → Confirmation with request number
- Check dashboard → Request appears
- Check Neon DB → All data saved correctly

### 📊 Metrics to Monitor:
- Response time: < 2 seconds
- Error rate: 0%
- Session persistence: 100%
- Dashboard sync: Immediate

## Next Steps After Testing

1. **If All Tests Pass**:
   - ✅ System is working correctly
   - ✅ Bot integrated with Neon DB
   - ✅ Dashboard showing live data
   - ✅ Ready for production use

2. **If Tests Fail**:
   - Check specific error logs
   - Verify database schema matches
   - Check environment variables
   - Review this guide's troubleshooting section

3. **Additional Testing**:
   - Test with multiple users
   - Test concurrent requests
   - Test error handling
   - Test edge cases (empty data, invalid input)

## Support

If issues persist:
1. Check `CRITICAL_FIXES_APPLIED.md` for technical details
2. Review server logs for specific errors
3. Verify Neon DB connection and data
4. Check WhatsApp API credentials and webhook

---

**Status**: All critical fixes applied. System ready for testing with live Neon DB data.
