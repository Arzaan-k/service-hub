# ContainerGenie API Documentation

## Overview
This document provides comprehensive API documentation for the ContainerGenie Container Service Management System.

## Base URL
- Development: `http://localhost:5000`
- Production: `https://your-domain.com`

## Authentication
All API endpoints require authentication via the `x-user-id` header:
```bash
curl -H "x-user-id: user-id-here" http://localhost:5000/api/dashboard/stats
```

## API Endpoints

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |

### Containers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/containers` | Get all containers |
| GET | `/api/containers/:id` | Get container by ID |
| PUT | `/api/containers/:id` | Update container |
| GET | `/api/containers/:id/location-history` | Get container location history |
| GET | `/api/containers/:id/service-history` | Get container service history |
| GET | `/api/containers/:id/metrics` | Get container metrics |
| POST | `/api/containers/:id/assign` | Assign container to customer |
| POST | `/api/containers/:id/unassign` | Unassign container |
| GET | `/api/containers/iot/enabled` | Get IoT enabled containers |
| GET | `/api/containers/status/:status` | Get containers by status |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | Get all alerts |
| GET | `/api/alerts/open` | Get open alerts |
| GET | `/api/alerts/:id` | Get alert by ID |
| GET | `/api/alerts/severity/:severity` | Get alerts by severity |
| GET | `/api/alerts/source/:source` | Get alerts by source |
| PUT | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| PUT | `/api/alerts/:id/resolve` | Resolve alert |
| GET | `/api/alerts/container/:containerId` | Get alerts for container |

### Service Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/service-requests` | Get all service requests |
| GET | `/api/service-requests/:id` | Get service request by ID |
| GET | `/api/service-requests/status/:status` | Get service requests by status |
| GET | `/api/service-requests/priority/:priority` | Get service requests by priority |
| GET | `/api/service-requests/technician/:technicianId` | Get service requests for technician |
| GET | `/api/service-requests/customer/:customerId` | Get service requests for customer |
| POST | `/api/service-requests/:id/assign` | Assign service request to technician |
| POST | `/api/service-requests/:id/start` | Start service request |
| POST | `/api/service-requests/:id/complete` | Complete service request |
| POST | `/api/service-requests/:id/cancel` | Cancel service request |
| GET | `/api/service-requests/:id/timeline` | Get service request timeline |

### Technicians
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/technicians` | Get all technicians |
| GET | `/api/technicians/:id` | Get technician by ID |
| GET | `/api/technicians/:id/performance` | Get technician performance |
| GET | `/api/technicians/:id/schedule` | Get technician schedule |
| GET | `/api/technicians/skills/:skill` | Get technicians by skill |
| GET | `/api/technicians/location/:location` | Get technicians by location |
| PUT | `/api/technicians/:id/status` | Update technician status |
| PUT | `/api/technicians/:id/location` | Update technician location |
| POST | `/api/technicians` | Create technician |
| PUT | `/api/technicians/:id` | Update technician |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | Get all customers |
| GET | `/api/customers/:id` | Get customer by ID |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |

### AI Scheduling
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scheduling/optimize` | Optimize daily schedules |
| GET | `/api/scheduling/technician/:technicianId` | Get technician schedule |
| POST | `/api/scheduling/reschedule` | Reschedule service request |

### Invoicing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoicing/generate` | Generate invoice |
| POST | `/api/invoicing/payment` | Process payment |
| POST | `/api/invoicing/send` | Send invoice to customer |
| GET | `/api/invoicing/analytics` | Get invoice analytics |

### Feedback Collection
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/feedback/request` | Send feedback request |
| POST | `/api/feedback/submit` | Submit feedback |
| GET | `/api/feedback/analytics` | Get feedback analytics |
| GET | `/api/feedback/technician/:technicianId` | Get technician feedback summary |
| POST | `/api/feedback/reminder` | Send feedback reminder |

### Inventory Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | Get all inventory items |
| GET | `/api/inventory/:id` | Get inventory item by ID |
| POST | `/api/inventory` | Create inventory item |
| PUT | `/api/inventory/:id` | Update inventory item |
| DELETE | `/api/inventory/:id` | Delete inventory item |
| POST | `/api/inventory/add-stock` | Add stock to inventory |
| POST | `/api/inventory/remove-stock` | Remove stock from inventory |
| POST | `/api/inventory/adjust-stock` | Adjust stock quantity |
| GET | `/api/inventory/reorder-alerts` | Get reorder alerts |
| GET | `/api/inventory/analytics` | Get inventory analytics |
| GET | `/api/inventory/search` | Search inventory items |
| GET | `/api/inventory/category/:category` | Get items by category |
| GET | `/api/inventory/transactions` | Get inventory transactions |

### WhatsApp Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/send` | Send WhatsApp message |
| POST | `/api/whatsapp/send-buttons` | Send interactive buttons |
| POST | `/api/whatsapp/send-list` | Send list message |
| POST | `/api/whatsapp/send-media` | Send media message |
| POST | `/api/whatsapp/send-template` | Send template message |
| POST | `/api/whatsapp/send-flow` | Send flow message |
| POST | `/api/whatsapp/send-critical-alert` | Send critical alert |
| POST | `/api/whatsapp/send-technician-schedule` | Send technician schedule |
| POST | `/api/whatsapp/send-invoice` | Send invoice |
| POST | `/api/whatsapp/send-feedback-request` | Send feedback request |

### Orbcomm Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orbcomm/status` | Get Orbcomm connection status |
| POST | `/api/orbcomm/populate` | Populate devices from Orbcomm |
| POST | `/api/orbcomm/refresh` | Refresh Orbcomm data |
| POST | `/api/orbcomm/test` | Test Orbcomm connection |

### IoT Polling
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/iot/poll` | Poll IoT devices for data |

## Request/Response Examples

### Dashboard Stats
```bash
GET /api/dashboard/stats
Headers: x-user-id: user-123

Response:
{
  "totalContainers": "10",
  "activeContainersCount": "8",
  "activeAlerts": "3",
  "pendingServices": "5"
}
```

### Create Service Request
```bash
POST /api/service-requests
Headers: x-user-id: user-123
Content-Type: application/json

{
  "containerId": "container-123",
  "customerId": "customer-456",
  "issueDescription": "Container door not closing properly",
  "priority": "high",
  "requiredParts": ["door_hinge", "door_seal"]
}

Response:
{
  "id": "sr-789",
  "requestNumber": "SR-2024-001",
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### AI Scheduling Optimization
```bash
POST /api/scheduling/optimize
Headers: x-user-id: user-123
Content-Type: application/json

{
  "date": "2024-01-16",
  "constraints": {
    "maxWorkingHours": 8,
    "maxTravelDistance": 100,
    "skillRequirements": ["container_repair"],
    "priorityWeights": {
      "urgent": 1.0,
      "high": 0.8,
      "normal": 0.6,
      "low": 0.4
    }
  }
}

Response:
[
  {
    "technicianId": "tech-123",
    "serviceRequestId": "sr-789",
    "scheduledTime": "2024-01-16T09:00:00Z",
    "estimatedTravelTime": 30,
    "estimatedServiceDuration": 120,
    "routeOrder": 1,
    "totalDistance": 15.5,
    "optimizationScore": 85.5
  }
]
```

### Generate Invoice
```bash
POST /api/invoicing/generate
Headers: x-user-id: user-123
Content-Type: application/json

{
  "serviceRequestId": "sr-789"
}

Response:
{
  "id": "inv-123",
  "invoiceNumber": "INV-202401-0001",
  "serviceRequestId": "sr-789",
  "customerId": "customer-456",
  "totalAmount": "1250.00",
  "dueDate": "2024-02-15T00:00:00Z",
  "paymentStatus": "pending"
}
```

### Submit Feedback
```bash
POST /api/feedback/submit
Headers: x-user-id: user-123
Content-Type: application/json

{
  "serviceRequestId": "sr-789",
  "customerId": "customer-456",
  "response": {
    "rating": 5,
    "feedbackText": "Excellent service, technician was very professional",
    "quickFeedbackTags": ["Excellent service", "Professional technician"],
    "issueResolved": true,
    "followUpRequired": false
  }
}

Response:
{
  "id": "fb-123",
  "serviceRequestId": "sr-789",
  "customerId": "customer-456",
  "technicianId": "tech-123",
  "rating": "5",
  "feedbackText": "Excellent service, technician was very professional",
  "quickFeedbackTags": ["Excellent service", "Professional technician"],
  "issueResolved": true,
  "submittedAt": "2024-01-15T14:30:00Z"
}
```

### Inventory Management
```bash
POST /api/inventory
Headers: x-user-id: user-123
Content-Type: application/json

{
  "partNumber": "DOOR-HINGE-001",
  "partName": "Container Door Hinge",
  "category": "Mechanical Parts",
  "quantityInStock": 50,
  "reorderLevel": 10,
  "unitPrice": 25.00,
  "location": "Warehouse A-1",
  "description": "Heavy-duty door hinge for 20ft containers"
}

Response:
{
  "id": "inv-item-123",
  "partNumber": "DOOR-HINGE-001",
  "partName": "Container Door Hinge",
  "category": "Mechanical Parts",
  "quantityInStock": 50,
  "reorderLevel": 10,
  "unitPrice": "25.00",
  "location": "Warehouse A-1",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

```json
{
  "error": "Error description",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per 15 minutes per user
- 1000 requests per hour per IP address

## WebSocket Support

Real-time updates are available via WebSocket connection:
- **URL**: `ws://localhost:5000` (development)
- **Events**: Container updates, alert notifications, service request status changes

## Webhook Support

WhatsApp webhook endpoint:
- **URL**: `POST /api/webhook/whatsapp`
- **Verification**: Uses `WEBHOOK_VERIFICATION_TOKEN`

## SDK and Libraries

### JavaScript/TypeScript
```bash
npm install @container-genie/sdk
```

### Python
```bash
pip install container-genie-sdk
```

### cURL Examples
All endpoints can be tested using cURL with the provided examples above.

## Support

For API support and questions:
1. Check the application logs
2. Verify authentication headers
3. Test with provided examples
4. Contact the development team
