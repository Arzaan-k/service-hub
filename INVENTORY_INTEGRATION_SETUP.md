# Inventory Integration Setup Guide

## Overview
This guide explains how to integrate your Service Request project with your Inventory Management system.

## Features
- ✅ Automatic order creation in Inventory System when "Request Indent" is clicked
- ✅ Prevents duplicate orders for the same service request
- ✅ Parses required parts with quantities
- ✅ Sends customer and service request details to Inventory System
- ✅ Shows success toast: "Indent Requested Successfully — Order Created in Inventory System"
- ✅ Displays order number after successful creation

## Configuration

### Step 1: Add Environment Variables
Add the following variables to your `.env` file:

```env
# Inventory Management System Integration
INVENTORY_API_URL=http://localhost:5000
INVENTORY_API_KEY=your_api_key_here
INVENTORY_API_SECRET=your_api_secret_here
```

Replace the values with your actual Inventory System credentials:
- `INVENTORY_API_URL`: The base URL of your Inventory Management API
- `INVENTORY_API_KEY`: Your API key for authentication
- `INVENTORY_API_SECRET`: Your API secret for authentication

### Step 2: Database Migration (Run Later)

**IMPORTANT:** The integration currently works WITHOUT database changes!

Order information is temporarily stored in the `resolution_notes` field of service requests. This allows the feature to work immediately without requiring database migrations.

**When you're ready to migrate** (optional, for better data structure):

Run the migration script:
```bash
psql $DATABASE_URL -f migrations/add_inventory_fields.sql
```

Or manually:
```sql
ALTER TABLE service_requests 
ADD COLUMN inventory_order_id TEXT,
ADD COLUMN inventory_order_number TEXT,
ADD COLUMN inventory_order_created_at TIMESTAMP;
```

After migration, uncomment the fields in `shared/schema.ts` (lines 256-258) and restart the server.

## How It Works

### 1. User Flow
1. User opens a Service Request detail page
2. User adds required parts using "Manage Parts" button
3. User clicks "Request Indent" button
4. System creates an order in the Inventory Management System
5. Success toast is displayed with order details
6. Button changes to show "✓ Order Created: [Order Number]"

### 2. API Endpoint
**POST** `/api/service-requests/:id/request-indent`

**Request Body:** None (reads from service request's `requiredParts` field)

**Response:**
```json
{
  "success": true,
  "message": "Indent Requested Successfully — Order Created in Inventory System",
  "orderId": "uuid-here",
  "orderNumber": "#ORD-123456",
  "serviceRequest": { ... }
}
```

### 3. Data Sent to Inventory System
```json
{
  "customerName": "Company Name",
  "customerEmail": "customer@example.com",
  "customerPhone": "+1234567890",
  "items": [
    {
      "productName": "Asian Apcolite White Oil Paint 4 Ltr",
      "quantity": 1
    },
    {
      "productName": "Acetylene",
      "quantity": 1
    }
  ],
  "serviceRequestNumber": "SR-12345",
  "notes": "Service Request: SR-12345\nIssue: Container temperature issue",
  "source": "service_request",
  "sourceReference": "SR-12345",
  "status": "needs_approval",
  "total": 0.00
}
```

### 4. Expected Inventory API Endpoint
Your Inventory System should have an endpoint:

**POST** `/api/orders`

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your_api_key`
- `X-API-Secret: your_api_secret`

**Expected Response:**
```json
{
  "success": true,
  "orderId": "uuid-here",
  "orderNumber": "#ORD-123456"
}
```

## Part Format
Parts are stored in the format: `"Part Name (quantity)"`

Examples:
- `"Asian Apcolite White Oil Paint 4 Ltr (1)"`
- `"Acetylene (2)"`
- `"Asian Apcolite Black Paint 1 Ltr (6)"`

The system automatically parses these to extract:
- Product Name: "Asian Apcolite White Oil Paint 4 Ltr"
- Quantity: 1

## Duplicate Prevention
The system checks if `inventoryOrderId` already exists for the service request. If it does, the API returns:

```json
{
  "error": "Indent already requested for this service request",
  "orderId": "existing-order-id",
  "orderNumber": "#ORD-123456"
}
```

## Error Handling

### Configuration Not Set
If environment variables are missing:
```json
{
  "error": "Inventory system integration not configured. Please add INVENTORY_API_URL, INVENTORY_API_KEY, and INVENTORY_API_SECRET to .env file"
}
```

### No Parts Available
If service request has no required parts:
```json
{
  "error": "No required parts found in service request"
}
```

### API Connection Error
If Inventory System is unreachable:
```json
{
  "error": "Failed to create order in Inventory System"
}
```

## Testing

### 1. Test with Mock Data
You can test the integration by:
1. Creating a service request
2. Adding parts: "Test Part (5)"
3. Clicking "Request Indent"
4. Checking the console logs for API calls

### 2. Console Logs
The system logs all inventory operations:
```
[Inventory Integration] Creating order: {
  serviceRequestNumber: 'SR-12345',
  customerName: 'ABC Company',
  itemCount: 3
}
[Inventory Integration] ✅ Order created successfully: {
  orderId: 'uuid-here',
  orderNumber: '#ORD-123456'
}
```

## Files Modified

### Backend
- `server/services/inventoryIntegration.ts` - New service for inventory API calls
- `server/routes.ts` - Added `/api/service-requests/:id/request-indent` endpoint
- `shared/schema.ts` - Added inventory tracking fields to service_requests table

### Frontend
- `client/src/pages/service-request-detail.tsx` - Updated "Request Indent" button logic

## Troubleshooting

### Issue: Button stays disabled
**Solution:** Make sure the service request has required parts added

### Issue: "Configuration not set" error
**Solution:** Add the three environment variables to your `.env` file

### Issue: Order created but not showing
**Solution:** Refresh the page to see the updated order status

### Issue: Duplicate orders being created
**Solution:** Check that the `inventoryOrderId` field is being properly saved to the database

## Support
For issues or questions, check the console logs for detailed error messages.
