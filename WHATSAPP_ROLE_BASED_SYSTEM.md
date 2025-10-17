# Enhanced WhatsApp Role-Based System

## Overview

The WhatsApp system has been completely enhanced to provide role-based authentication and tailored responses based on the user's role (Client or Technician). The system now identifies users by their phone numbers and provides appropriate information and functionality based on their role.

## Key Features

### 🔐 Enhanced Authentication
- **Phone Number Matching**: Identifies users by matching incoming WhatsApp numbers with database records
- **Role Verification**: Verifies that users have corresponding client or technician profiles
- **Multi-format Support**: Handles phone numbers with/without country codes (e.g., +91, 91, or without)
- **Account Status Validation**: Checks for active accounts and WhatsApp verification status

### 👥 Role-Based Responses

#### For Clients:
- **Container Status**: Real-time status of all client containers with detailed breakdown
- **Service Requests**: View active requests, create new ones, and track progress
- **Invoice Management**: Check pending invoices and payment status
- **Alert Monitoring**: View critical alerts for client containers
- **Container Tracking**: Location and status tracking for active containers
- **Service History**: Complete history of completed services

#### For Technicians:
- **Daily Schedule**: View scheduled services with time slots and locations
- **Performance Stats**: Personal performance metrics and ratings
- **Location Management**: Update location and view service routes
- **Inventory Status**: Check parts inventory and low stock items
- **Status Updates**: Change availability status (Available, Busy, Off Duty)
- **Emergency Support**: Quick access to emergency contact information

## Technical Implementation

### Authentication Flow

```typescript
// Enhanced authorization function
export async function authorizeWhatsAppMessage(phoneNumber: string): Promise<{
  authorized: boolean, 
  user?: any, 
  roleData?: any, 
  error?: string
}> {
  // 1. Normalize phone number (remove non-digits)
  // 2. Try different formats (with/without country code)
  // 3. Verify user exists and is active
  // 4. Check WhatsApp verification status
  // 5. Get role-specific data (customer or technician profile)
  // 6. Return comprehensive authorization result
}
```

### Message Processing Pipeline

```
Incoming WhatsApp Message
    ↓
Phone Number Authentication 
    ↓ 
Role Identification (Client/Technician)
    ↓
Role-Specific Data Retrieval
    ↓
Message Type Detection (Text/Interactive/Media)
    ↓
Role-Based Handler Execution
    ↓
Tailored Response Generation
```

### Client Message Handlers

| Command | Function | Description |
|---------|----------|-------------|
| `status`, `container` | `handleClientContainerStatus()` | Shows container status summary |
| `service`, `help`, `request` | `handleClientServiceRequests()` | Manages service requests |
| `invoice`, `bill`, `payment` | `handleClientInvoices()` | Shows billing information |
| `alert`, `notification` | `handleClientAlerts()` | Displays active alerts |
| `location`, `track` | `handleClientContainerTracking()` | Container tracking info |
| `history` | `handleClientServiceHistory()` | Service history |

### Technician Message Handlers

| Command | Function | Description |
|---------|----------|-------------|
| `schedule`, `today` | `handleTechnicianSchedule()` | Daily schedule with time slots |
| `performance`, `stats` | `handleTechnicianPerformance()` | Performance metrics |
| `location`, `route` | `handleTechnicianLocation()` | Location and route info |
| `inventory`, `parts` | `handleTechnicianInventory()` | Parts inventory status |

## Interactive Features

### Client Interactive Buttons
- 📊 Container Status
- 🚨 View Alerts  
- 🔧 Request Service
- 💰 Check Invoices
- 📍 Track Containers
- 📋 Service History

### Technician Interactive Buttons
- 📅 View Schedule
- 🔧 Start Service
- 📊 Update Status
- 🆘 Emergency Help

## Database Integration

The system integrates with the existing database schema:

- **Users Table**: Core user authentication and role information
- **Customers Table**: Client-specific data (company, contact person, WhatsApp number)
- **Technicians Table**: Technician-specific data (employee code, skills, experience)
- **Containers Table**: Container information and assignments
- **Service Requests Table**: Service request management
- **Alerts Table**: Alert and notification system
- **Invoices Table**: Billing and payment information

## Security Features

### Authentication Validation
- ✅ Phone number verification
- ✅ Account active status check
- ✅ WhatsApp verification status
- ✅ Role-specific profile validation

### Data Access Control
- 🔒 Clients can only access their own containers and service requests
- 🔒 Technicians can only access their assigned jobs and schedule
- 🔒 Role-based data filtering for all information

## Usage Examples

### Client Interaction
```
Client: "status"
System: 📊 Container Status for ABC Company

📦 Total Containers: 25

🟢 Active: 20
🔧 In Service: 3
⚠️ Maintenance: 2

🚨 Critical Alerts: 1

📅 Last Updated: Oct 16, 2024 2:30 PM
```

### Technician Interaction
```
Technician: "schedule"
System: 📅 Schedule for Oct 16, 2024

👤 TECH001 - AVAILABLE

📋 Today's Services: 3

1. SR-001234
   🕐 Time: 10:00 AM
   📍 Location: Available in app
   ⏱️ Duration: 60min
   📊 Status: SCHEDULED

2. SR-001235
   🕐 Time: 2:00 PM
   📍 Location: Available in app
   ⏱️ Duration: 90min
   📊 Status: SCHEDULED
```

## Error Handling

The system provides comprehensive error handling:

- **Unregistered Numbers**: Clear instructions to contact support
- **Inactive Accounts**: Account status information
- **Missing Profiles**: Profile completion guidance
- **System Errors**: Graceful fallback with retry instructions

## Testing

Use the provided test script to verify the system:

```bash
node test-whatsapp-auth.js
```

## Enhanced WhatsApp Hub Features

### Template Management
The WhatsApp Hub now includes comprehensive template management:

#### 📋 Template Display
- **Status Filtering**: Filter templates by status (All, Approved, Pending, Rejected)
- **Detailed Information**: View template components, buttons, and structure
- **Real-time Status**: Live status updates from WhatsApp Business API

#### ✏️ Template Editing
- **Create Templates**: Full template creation with component builder
- **Edit Existing**: Modify approved templates (creates new version)
- **Component Management**: Add/edit headers, bodies, footers, and buttons
- **Button Types**: Support for Quick Reply, Phone Number, and URL buttons
- **Preview Mode**: Live preview of template structure before saving

#### 🛠️ Template Operations
- **Register All**: Bulk register all local templates to WhatsApp
- **Delete Templates**: Remove unwanted templates
- **Status Management**: Track template approval status

#### Template Structure Support
```
Header (Optional): Title or greeting text
Body (Required): Main message content with variables {{1}}, {{2}}
Footer (Optional): Additional information
```

#### Template Categories
- **Utility**: Service notifications, alerts, confirmations
- **Marketing**: Promotional messages, announcements
- **Authentication**: Verification codes, security alerts

## WhatsApp Business API Setup Guide

### Prerequisites
1. **Facebook Developer Account** - Create at https://developers.facebook.com
2. **WhatsApp Business Account** - Set up through Facebook Business
3. **WhatsApp Business API Access** - Request access through Meta

### Environment Variables Required

```bash
# WhatsApp Business API Configuration
WA_PHONE_NUMBER_ID=your_phone_number_id
CLOUD_API_ACCESS_TOKEN=your_access_token
WEBHOOK_VERIFICATION_TOKEN=your_webhook_token
```

### Getting WhatsApp Credentials

#### Step 1: Create Facebook App
1. Go to https://developers.facebook.com
2. Click "Create App" → "Business"
3. Add WhatsApp product to your app

#### Step 2: Configure WhatsApp
1. In your app dashboard, go to WhatsApp → API Setup
2. Copy the **Phone Number ID**
3. Generate an **Access Token** from Meta Business settings

#### Step 3: Set Webhook
1. Set webhook URL: `https://your-domain.com/api/webhook/whatsapp`
2. Set verification token (any string you choose)
3. Subscribe to: messages, message_status, message_template_status

### Testing WhatsApp Integration

#### Quick Setup Test
```bash
# Run the setup script
node setup-whatsapp.js

# Test WhatsApp integration
node test-whatsapp-integration.js
```

#### Manual Testing
1. **Check Configuration**:
```bash
curl -s http://localhost:5000/api/whatsapp/templates
```

2. **Register Templates**:
```bash
curl -X POST http://localhost:5000/api/whatsapp/templates/register-all
```

3. **Send Test Message**:
```bash
curl -X POST http://localhost:5000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"to":"+1234567890","text":"Test message"}'
```

### Common Issues & Solutions

#### ❌ "WhatsApp configuration missing"
**Solution**: Set environment variables in `.env`:
```bash
WA_PHONE_NUMBER_ID=your_phone_number_id
CLOUD_API_ACCESS_TOKEN=your_access_token
```

#### ❌ "Template registration failed"
**Causes**:
1. Invalid template structure
2. Missing WhatsApp API permissions
3. Template name already exists

**Solutions**:
1. Check template format matches WhatsApp API requirements
2. Ensure you have "Business Messaging" permission
3. Use unique template names

#### ❌ "Message sending failed"
**Causes**:
1. Invalid phone number format
2. Phone number not opted in to WhatsApp Business
3. Rate limiting

**Solutions**:
1. Use international format: `+1234567890`
2. Ensure customer has opted in to WhatsApp messaging
3. Implement rate limiting in your code

### Client Notification System

#### Automatic Alert Notifications
- **Triggered by**: Alert creation/update
- **Recipients**: Container owners via WhatsApp
- **Templates Used**:
  - `CRITICAL_ALERT` for critical issues
  - `HIGH_ALERT` for high priority issues
  - Text messages for other severities

#### Container Updates
- **Service Scheduling**: Clients notified when services are scheduled
- **Status Changes**: Container status updates sent automatically
- **Invoice Generation**: Billing notifications via WhatsApp

#### Setup Requirements
1. **Customer WhatsApp Numbers**: Ensure customers have `whatsappNumber` field populated
2. **Template Approval**: Templates must be approved by WhatsApp
3. **Opt-in Confirmation**: Customers must opt-in to WhatsApp messaging

### Template Structure Requirements

#### Header Component
```json
{
  "type": "HEADER",
  "format": "TEXT",
  "text": "Alert Title"
}
```

#### Body Component (Required)
```json
{
  "type": "BODY",
  "text": "Container {{1}} needs attention. Issue: {{2}}"
}
```

#### Footer Component
```json
{
  "type": "FOOTER",
  "text": "Reply URGENT for immediate assistance"
}
```

### Template Variables
- Use `{{1}}`, `{{2}}`, etc. for dynamic content
- Variables are replaced when sending messages
- Maximum 10 variables per template

## Future Enhancements

Potential future improvements:
- 📱 Rich media support (images, documents, location sharing)
- 🤖 AI-powered response suggestions
- 📈 Advanced analytics and reporting
- 🔔 Proactive notification system
- 🌐 Multi-language support
- 📊 Template performance analytics

## Deployment Notes

Ensure the following before deployment:
1. All phone numbers in the database are properly formatted
2. WhatsApp verification status is set for authorized users
3. Client and technician profiles are complete
4. Test with actual phone numbers in your system

The enhanced WhatsApp system is now ready for production use with comprehensive role-based authentication and tailored user experiences!
