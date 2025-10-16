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

## Future Enhancements

Potential future improvements:
- 📱 Rich media support (images, documents, location sharing)
- 🤖 AI-powered response suggestions
- 📈 Advanced analytics and reporting
- 🔔 Proactive notification system
- 🌐 Multi-language support

## Deployment Notes

Ensure the following before deployment:
1. All phone numbers in the database are properly formatted
2. WhatsApp verification status is set for authorized users
3. Client and technician profiles are complete
4. Test with actual phone numbers in your system

The enhanced WhatsApp system is now ready for production use with comprehensive role-based authentication and tailored user experiences!
