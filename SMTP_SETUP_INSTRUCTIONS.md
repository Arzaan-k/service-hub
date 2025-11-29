# SMTP Configuration for Password Reset

## Issue: Password Reset Emails Not Sending

The password reset functionality requires SMTP configuration to send emails. Currently, SMTP is not configured, so password reset emails are not being sent.

## Solution: Configure SMTP Settings

### Option 1: Gmail SMTP (Recommended for Development)

1. **Create an App Password in Gmail:**
   - Go to your Google Account settings
   - Enable 2-Factor Authentication if not already enabled
   - Go to Security → App passwords
   - Generate a new app password for "ContainerGenie"

2. **Create .env file in project root:**
   ```bash
   # SMTP Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password-here
   SMTP_SECURE=false

   # Email Settings
   EMAIL_FROM=noreply@containergenie.com
   FRONTEND_URL=http://localhost:5000
   ```

### Option 2: Mailgun (Production Recommended)

1. **Sign up for Mailgun** at mailgun.com
2. **Configure in .env:**
   ```bash
   MAILGUN_API_KEY=your-mailgun-api-key
   MAILGUN_DOMAIN=your-domain.mailgun.org
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Option 3: Other SMTP Providers

For Outlook, Yahoo, or other providers, adjust the SMTP settings accordingly.

## How to Test

1. Create the `.env` file with your SMTP settings
2. Restart the server: `npm run dev`
3. Try password reset - you should see "✅ Email service configured with SMTP" in server logs
4. If SMTP fails, check server logs for the reset code as fallback

## Current Status

- **SMTP Configured:** ❌ No
- **Fallback:** ✅ Reset codes logged to server console
- **Mailgun Configured:** ❌ No

To enable email sending, configure SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.
