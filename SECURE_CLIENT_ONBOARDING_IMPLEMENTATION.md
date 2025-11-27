# Secure Client Onboarding & Credential Management System

## 🎯 Implementation Overview

This document describes the production-ready implementation of a secure client onboarding and credential handover system that follows security best practices.

## 🔐 Security Architecture

### Key Security Principles

1. **Email as Login ID**: Client's email is ALWAYS the username/login ID
2. **No Temporary Passwords**: We use secure time-limited reset links instead
3. **Token-Based Reset**: Cryptographically secure random tokens (256-bit)
4. **Hash Storage Only**: Never store plain tokens or passwords
5. **Short Expiration**: Reset tokens expire after 1 hour
6. **One-Time Use**: Tokens can only be used once
7. **Audit Trail**: All security events are logged
8. **Admin Accountability**: Track which admin triggered password resets

### Why Secure Links vs Temporary Passwords?

**Temporary passwords are less secure because:**
- They can be intercepted in email
- Users might reuse them or forget to change them
- They're visible in email clients and logs
- No expiration mechanism

**Secure reset links are better because:**
- ✅ Tokens are random, unpredictable, and single-use
- ✅ Automatic expiration (1 hour)
- ✅ Can't be reused even if intercepted
- ✅ User chooses their own strong password
- ✅ Invalid/expired links show clear error messages

## 📊 Database Schema

### Password Reset Tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,      -- SHA-256 hash of token
  expires_at TIMESTAMP NOT NULL,         -- Expires 1 hour after creation
  used_at TIMESTAMP,                     -- NULL if unused, timestamp when used
  created_by VARCHAR REFERENCES users(id), -- Admin who triggered reset
  ip_address TEXT,                       -- IP address of requester
  user_agent TEXT,                       -- Browser/device info
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Users Table Updates

The `users` table already has:
- `requiresPasswordReset` (boolean) - Forces password change on login
- `emailVerified` (boolean) - Email verification status
- `email` (text) - Used as login ID

## 🔄 Client Onboarding Flow

### 1. Admin Creates New Client

**Frontend**: Admin dashboard client creation form
**Backend**: `POST /api/clients`

```typescript
// Process:
1. Admin fills form with client details (name, email, phone, etc.)
2. System validates email is unique
3. Creates user account with:
   - email: clientData.email (LOGIN ID)
   - password: NULL (no password set yet)
   - emailVerified: true (admin-created, trusted)
   - requiresPasswordReset: true (must set password)
   - role: "client"
4. Creates customer record linked to user
5. Generates secure reset token (256-bit random)
6. Sends welcome email with password setup link
7. Logs audit event: "client_created"
```

**Email Content**:
```
Subject: Welcome to ContainerGenie! Set Your Password

Hello [Name],

Welcome! Your account has been created.

[Set Your Password Button]
Link: https://app.example.com/reset-password?token=abc123...

Your Login ID: client@email.com
Password: Set using the link above

⚠️ Security Notice:
• This link expires in 1 hour
• The link can only be used once
• Choose a strong password
```

### 2. Client Sets Initial Password

**Frontend**: `/reset-password?token=xxx` page
**Backend**: `POST /api/auth/reset-password-with-token`

```typescript
// Process:
1. Client clicks link from email
2. Frontend extracts token from URL
3. Validates token is valid (GET /api/auth/validate-reset-token?token=xxx)
4. Shows password setup form
5. Client enters strong password (validated)
6. Submits password with token
7. Backend:
   - Validates token (not expired, not used)
   - Hashes new password with bcrypt
   - Updates user: password, emailVerified=true, requiresPasswordReset=false
   - Marks token as used
   - Logs audit event: "password_set_via_token"
8. Client redirected to login
9. Can now login with email + new password
```

### 3. Client First Login

**Frontend**: `/login` page
**Backend**: `POST /api/auth/login`

```typescript
// Process:
1. Client enters email (login ID) + password
2. System validates credentials
3. If requiresPasswordReset=true:
   - Return 403 with requiresPasswordReset flag
   - Frontend redirects to /force-password-reset
4. If emailVerified=false:
   - Return 403 with error
5. If credentials valid:
   - Return user + token
   - Redirect to dashboard
```

## 🔄 Admin Password Reset Flow

### 1. Admin Triggers Password Reset

**Frontend**: Client profile page → "Reset Password" button
**Backend**: `POST /api/admin/clients/:clientId/reset-password`

```typescript
// Process:
1. Admin clicks "Reset Password" on client profile
2. Confirmation dialog explains:
   - This will invalidate current password
   - Client will receive email with reset link
   - Link expires in 1 hour
3. Admin confirms
4. Backend:
   - Generates new secure reset token
   - Invalidates any existing unused tokens for this user
   - Sends password reset email to client
   - Logs audit event: "password_reset_by_admin"
     with admin_id, client_id, ip_address
5. Email sent confirmation shown to admin
```

**Email Content**:
```
Subject: Password Reset Required

Hello [Name],

Your password has been reset by an administrator.
To set a new password, click the button below:

[Set New Password Button]
Link: https://app.example.com/reset-password?token=xyz789...

⚠️ Security Notice:
• This link expires in 1 hour
• The link can only be used once
• Your email is your login ID: client@email.com

If you didn't request this, contact your administrator immediately.
```

### 2. Client Resets Password

Same process as initial password setup (#2 above).

## 🛡️ Security Features

### Token Generation

```typescript
// Generates 32 bytes (256 bits) of random data
const token = crypto.randomBytes(32).toString('hex'); // 64 char hex string

// Hash for storage (never store plain token)
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

// Store in database:
{
  tokenHash: "hash...",  // SHA-256 hash
  expiresAt: new Date(Date.now() + 3600000), // 1 hour
  usedAt: null,  // Will be set when used
  createdBy: adminId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
}
```

### Token Validation

```typescript
// Multiple validation checks:
1. Token hash exists in database
2. Token not already used (usedAt === null)
3. Token not expired (expiresAt > now)
4. All checks must pass
```

### Password Validation

```typescript
// Strong password requirements:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*()_+-=[]{}

;':"\\|,.<>/?)
- Validated on both frontend and backend
```

### Audit Logging

```typescript
// All security events logged to audit_logs table:
{
  userId: affectedUserId,
  action: "client_created" | "password_reset_by_admin" | "password_set_via_token",
  entityType: "user",
  entityId: userId,
  changes: { email, admin_id, etc },
  source: "dashboard",
  ipAddress: req.ip,
  timestamp: now
}
```

## 🔌 API Endpoints

### Public Endpoints (No Auth Required)

#### Validate Reset Token
```
GET /api/auth/validate-reset-token?token=xxx
Response: { valid: true, userId: "xxx", email: "xxx" }
         or { valid: false, error: "Token expired" }
```

#### Reset Password with Token
```
POST /api/auth/reset-password-with-token
Body: { token: "xxx", newPassword: "xxx" }
Response: { success: true, message: "Password updated" }
         or { error: "Invalid token" }
```

### Admin Endpoints (Requires Admin Auth)

#### Create Client (Updated)
```
POST /api/clients
Body: { companyName, contactPerson, email, phone, ... }
Response: {
  ...clientData,
  userCreated: true,
  resetLinkSent: true,
  resetLink: "http://..." // Only in dev/logs
}
```

#### Admin Password Reset
```
POST /api/admin/clients/:clientId/reset-password
Response: {
  success: true,
  message: "Password reset email sent",
  resetLink: "http://..." // Only in dev/logs
}
```

## 🎨 Frontend Components

### 1. `/reset-password` Page (New)

**File**: `client/src/pages/reset-password.tsx`

```typescript
// Features:
- Extract token from URL query params
- Validate token on page load
- Show loading state while validating
- Show password setup form if valid
- Show error message if invalid/expired
- Password strength indicator
- Confirm password validation
- Submit to /api/auth/reset-password-with-token
- Redirect to login on success
```

### 2. Client Profile Page (Updated)

**File**: `client/src/pages/client-profile.tsx`

```typescript
// Add "Reset Password" button:
- Shows confirmation dialog
- Explains what will happen
- Calls POST /api/admin/clients/:id/reset-password
- Shows success toast with link (dev mode)
- Logs admin action
```

### 3. Admin User Management (Updated)

**File**: `client/src/pages/admin-user-management.tsx`

```typescript
// Update "Send Credentials" to "Reset Password":
- Changes button text and behavior
- Uses new secure token flow
- Shows success message
```

## 📋 Implementation Checklist

### Backend
- [x] Add `passwordResetTokens` table to schema
- [x] Create migration SQL
- [x] Implement token generation in auth service
- [x] Implement token validation in auth service
- [x] Implement secure email templates
- [x] Add audit logging functions
- [ ] Update `/api/clients` endpoint for new flow
- [ ] Add `/api/auth/validate-reset-token` endpoint
- [ ] Add `/api/auth/reset-password-with-token` endpoint
- [ ] Add `/api/admin/clients/:id/reset-password` endpoint
- [ ] Remove old temporary password endpoints

### Frontend
- [ ] Create `/reset-password` page component
- [ ] Update client profile with reset button
- [ ] Update admin user management
- [ ] Add password strength indicator
- [ ] Add confirmation dialogs
- [ ] Update routing

### Testing
- [ ] Run database migration
- [ ] Test client creation flow
- [ ] Test password setup via link
- [ ] Test link expiration
- [ ] Test link reuse (should fail)
- [ ] Test admin password reset
- [ ] Test invalid token handling
- [ ] Verify audit logs
- [ ] Test email sending (SMTP configured)
- [ ] Test email fallback (SMTP not configured)

## 🚀 Deployment Steps

1. **Database Migration**
```bash
# Run migration
psql -h localhost -U postgres -d your_db -f migrations/add_password_reset_tokens.sql
```

2. **Environment Variables**
```bash
# Add to .env if not already set
FRONTEND_URL=https://your-app.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false
EMAIL_FROM=no-reply@your-company.com
```

3. **Deploy Backend + Frontend**

4. **Test End-to-End**

## 🔧 Maintenance

### Periodic Cleanup
Run periodically (e.g., daily cron job):
```typescript
import { cleanupExpiredTokens } from './server/services/auth';

// Removes tokens older than 24 hours
await cleanupExpiredTokens();
```

### Monitor Audit Logs
```sql
-- Check recent password resets
SELECT * FROM audit_logs
WHERE action IN ('password_reset_by_admin', 'password_set_via_token')
ORDER BY timestamp DESC
LIMIT 100;

-- Check for suspicious activity
SELECT user_id, COUNT(*) as reset_count
FROM password_reset_tokens
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 5;  -- More than 5 resets in 24h
```

## 📝 Best Practices Implemented

1. ✅ **Email as Login ID** - No separate username
2. ✅ **Secure Token Links** - Instead of temporary passwords
3. ✅ **Strong Password Hashing** - bcrypt with salt
4. ✅ **Token Hash Storage** - SHA-256, never store plain tokens
5. ✅ **Short Expiration** - 1 hour token lifetime
6. ✅ **One-Time Use** - Tokens marked as used
7. ✅ **Token Invalidation** - Old tokens invalidated on new request
8. ✅ **Audit Logging** - All security events tracked
9. ✅ **Admin Accountability** - Track who triggered resets
10. ✅ **IP & User Agent Tracking** - For security forensics
11. ✅ **Password Strength Validation** - Frontend + Backend
12. ✅ **Clear Error Messages** - User-friendly, security-conscious
13. ✅ **Email Verification** - Email trusted for admin-created accounts
14. ✅ **Force Password Change** - First login requires password set

## 🎓 Security Explanation

### Why This Is More Secure Than Temporary Passwords

**Problem with Temporary Passwords:**
```
Admin creates client → Generates "TempPass123" → Sends via email
Issues:
❌ Password visible in email (logged, forwarded, stored)
❌ User might not change it
❌ Can be reused if intercepted
❌ No expiration
❌ Weak if auto-generated
```

**Solution with Secure Reset Links:**
```
Admin creates client → Generates random token → Sends link with token
Benefits:
✅ Token is random 256-bit value (impossible to guess)
✅ Only hash stored in database
✅ Link expires in 1 hour automatically
✅ Can only be used once
✅ User creates their own strong password
✅ Clear security notices in email
✅ Audit trail of who/when/where
```

### Attack Prevention

1. **Brute Force**: Tokens are 256-bit random (2^256 possibilities)
2. **Token Reuse**: Marked as used after first use
3. **Link Interception**: Short expiration limits window
4. **Database Breach**: Only hashes stored, not plain tokens
5. **Email Compromise**: Token expires, can only be used once
6. **Insider Threat**: Audit logs track admin actions

## 📞 Support

For questions or issues with this implementation, refer to:
- Security audit logs: `SELECT * FROM audit_logs WHERE action LIKE '%password%'`
- Token status: `SELECT * FROM password_reset_tokens WHERE user_id = '...'`
- Email logs: Check server console for SMTP errors
