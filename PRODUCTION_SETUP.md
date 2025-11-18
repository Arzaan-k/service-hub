# ContainerGenie Production Setup Guide

## Overview
This guide will help you set up ContainerGenie for production deployment with all features enabled.

## Prerequisites

### Required API Keys
1. **WhatsApp Business API**
   - Phone Number ID
   - Cloud API Access Token
   - Webhook Verification Token

2. **Google AI API**
   - Google AI API Key (for AI scheduling and alert classification)

3. **Database**
   - PostgreSQL database (Neon, AWS RDS, or self-hosted)

### Optional Integrations (for future)
- Email service (SendGrid, AWS SES)
- File storage (AWS S3, Cloudinary)
- Payment gateway (Stripe, Razorpay)
- Mapping service (Google Maps, Mapbox)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Application
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Orbcomm API (IoT Integration)
ORBCOMM_URL=wss://your-orbcomm-endpoint.com:44355/cdh
ORBCOMM_USERNAME=your_orbcomm_username
ORBCOMM_PASSWORD=your_orbcomm_password

# WhatsApp Business API
WA_PHONE_NUMBER_ID=your_phone_number_id
CLOUD_API_ACCESS_TOKEN=your_cloud_api_access_token
WEBHOOK_VERIFICATION_TOKEN=your_webhook_verification_token

# Google AI API
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your_secure_jwt_secret_key_here
ENCRYPTION_KEY=your_secure_encryption_key_here

# CORS
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
```

## Production Features

### 1. AI-Powered Scheduling Engine
- **Endpoint**: `/api/scheduling/optimize`
- **Features**:
  - Intelligent technician assignment
  - Route optimization
  - Priority-based scheduling
  - Real-time rescheduling

### 2. Automated Invoicing System
- **Endpoints**: `/api/invoicing/*`
- **Features**:
  - Automatic invoice generation
  - Multiple invoice templates
  - Payment processing
  - Analytics and reporting

### 3. Customer Feedback Collection
- **Endpoints**: `/api/feedback/*`
- **Features**:
  - WhatsApp-based feedback requests
  - Multi-question feedback forms
  - Performance analytics
  - Follow-up automation

### 4. Enhanced WhatsApp Integration
- **Endpoints**: `/api/whatsapp/*`
- **Features**:
  - Interactive buttons and lists
  - Media messages
  - Template messages
  - Flow messages
  - Automated workflows

### 5. Container Management
- **Endpoints**: `/api/containers/*`
- **Features**:
  - Real-time location tracking
  - IoT data integration
  - Service history
  - Performance metrics

### 6. Alert Management
- **Endpoints**: `/api/alerts/*`
- **Features**:
  - AI-powered classification
  - Severity-based routing
  - Automated notifications
  - Resolution tracking

### 7. Service Request Management
- **Endpoints**: `/api/service-requests/*`
- **Features**:
  - Priority-based queuing
  - Technician assignment
  - Status tracking
  - Timeline management

### 8. Technician Management
- **Endpoints**: `/api/technicians/*`
- **Features**:
  - Performance tracking
  - Skill management
  - Schedule optimization
  - Location tracking

## Database Setup

### 1. Run Migrations
```bash
npm run db:push
```

### 2. Seed Initial Data
```bash
curl -X POST http://localhost:5000/api/seed
```

## WhatsApp Business API Setup

### 1. Create WhatsApp Business Account
1. Go to [Facebook Business](https://business.facebook.com/)
2. Create a business account
3. Add WhatsApp Business API

### 2. Get API Credentials
1. Phone Number ID
2. Cloud API Access Token
3. Webhook Verification Token

### 3. Configure Webhook
- **URL**: `https://your-domain.com/api/webhook/whatsapp`
- **Verify Token**: Use your `WEBHOOK_VERIFICATION_TOKEN`
- **Events**: Subscribe to all message events

## Google AI API Setup

### 1. Create Google AI Project
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new project
3. Generate API key

### 2. Enable Required APIs
- Gemini API
- Vertex AI (if using advanced features)

## Deployment

### 1. Build Application
```bash
npm run build
```

### 2. Start Production Server
```bash
npm start
```

### 3. Environment Validation
The application will validate all required environment variables on startup.

## API Documentation

### Authentication
All API endpoints require authentication via `x-user-id` header:
```bash
curl -H "x-user-id: user-id-here" http://localhost:5000/api/dashboard/stats
```

### Key Endpoints

#### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/containers` - Container list
- `GET /api/alerts/open` - Open alerts
- `GET /api/service-requests` - Service requests

#### AI Scheduling
- `POST /api/scheduling/optimize` - Optimize daily schedules
- `GET /api/scheduling/technician/:id` - Get technician schedule
- `POST /api/scheduling/reschedule` - Reschedule service request

#### Invoicing
- `POST /api/invoicing/generate` - Generate invoice
- `POST /api/invoicing/payment` - Process payment
- `GET /api/invoicing/analytics` - Invoice analytics

#### Feedback
- `POST /api/feedback/request` - Send feedback request
- `POST /api/feedback/submit` - Submit feedback
- `GET /api/feedback/analytics` - Feedback analytics

#### WhatsApp
- `POST /api/whatsapp/send` - Send message
- `POST /api/whatsapp/send-buttons` - Send interactive buttons
- `POST /api/whatsapp/send-list` - Send list message

## Monitoring and Logging

### 1. Log Levels
- `debug`: Detailed debugging information
- `info`: General information
- `warn`: Warning messages
- `error`: Error messages

### 2. Health Checks
- `GET /api/health` - Application health
- `GET /api/orbcomm/status` - Orbcomm connection status

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files
- Use strong, unique secrets
- Rotate keys regularly

### 2. Database Security
- Use SSL connections
- Implement proper access controls
- Regular backups

### 3. API Security
- Implement rate limiting
- Use HTTPS in production
- Validate all inputs

## Troubleshooting

### Common Issues

1. **Orbcomm Connection Failed**
   - Check credentials
   - Verify network connectivity
   - Check firewall settings

2. **WhatsApp API Errors**
   - Verify phone number ID
   - Check access token
   - Validate webhook configuration

3. **Database Connection Issues**
   - Check DATABASE_URL
   - Verify SSL settings
   - Check network connectivity

4. **AI Features Not Working**
   - Verify GOOGLE_AI_API_KEY
   - Check API quotas
   - Validate request format

## Support

For production support and issues:
1. Check application logs
2. Verify environment configuration
3. Test individual API endpoints
4. Contact development team

## Future Integrations

The application is designed to easily integrate with:
- Email services (SendGrid, AWS SES)
- File storage (AWS S3, Cloudinary)
- Payment gateways (Stripe, Razorpay)
- Mapping services (Google Maps, Mapbox)
- Monitoring services (Sentry, DataDog)
