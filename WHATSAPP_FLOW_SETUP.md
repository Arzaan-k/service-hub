# WhatsApp Flow Setup Guide

## Overview
This guide explains how to set up and test the WhatsApp flows for ContainerGenie, including both client and technician interactions.

## Prerequisites
1. WhatsApp Business API access
2. Facebook Developer Account
3. WhatsApp Business Account
4. Valid phone numbers for testing

## Environment Configuration
The following environment variables must be set in your `.env` file:

```bash
# WhatsApp Business API Configuration
WA_PHONE_NUMBER_ID=your_phone_number_id
CLOUD_API_ACCESS_TOKEN=your_access_token
WEBHOOK_VERIFICATION_TOKEN=your_webhook_token
WABA_ID=your_business_account_id
```

## Setting Up WhatsApp Credentials
Run the setup script to configure your WhatsApp credentials:

```bash
node setup-whatsapp.js
```

## Registering WhatsApp Templates
Register all predefined message templates (16 out of 17 templates register successfully):

```bash
npm run whatsapp:templates
```

Note: One template (RESCHEDULE_CONFIRMATION) has formatting issues with WhatsApp API validation but this doesn't affect core functionality.

## Testing WhatsApp Integration
Run the integration test script to verify everything is working:

```bash
node test-whatsapp-integration.js
```

## Client WhatsApp Flow
When a client sends "hi", they receive interactive buttons:
- 📦 Check Container Details
- 🔧 Request Service
- 📋 Check Service Status
- 📊 Check Container Status

## Technician WhatsApp Flow
When a technician sends "hi", they receive interactive buttons:
- 📅 Check Schedule (Today/Tomorrow/Specific Date)
- 👤 View Profile
- 📊 Update Status

When viewing schedule details, technicians can:
- Start Service (requires location proof photo)
- End Service
- Upload documentation

## Location Proof Requirement
Technicians must send a photo as proof of arrival before starting a service. This photo is stored with the service record and visible in the dashboard.

## Webhook Configuration
Set your webhook URL in Meta Business settings:
```
https://your-domain.com/api/whatsapp/webhook
```

## Testing
Use the test numbers for development:
- Client test number: +917021307474
- Technician test number: +917021037474

These numbers automatically create test users and profiles for testing flows.

## Troubleshooting
1. Verify all environment variables are set correctly
2. Check that the webhook URL is accessible from the internet
3. Ensure templates are approved in the WhatsApp Business Manager
4. Confirm phone numbers are properly formatted (international format)

## Database Schema Updates
When adding new features, run database migrations:
```bash
npx drizzle-kit push
```