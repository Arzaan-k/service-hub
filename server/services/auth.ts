import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { db } from '../db';
import { emailVerifications, users, passwordResetTokens, auditLogs } from '@shared/schema';
import { and, eq, lt, isNull } from 'drizzle-orm';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return await bcrypt.compare(password, hash);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function getTransport() {
  // Free SMTP via environment-configurable transport (e.g., Gmail SMTP or any free SMTP)
  // Expect env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';

  return nodemailer.createTransport({ host, port, secure, auth: user && pass ? { user, pass } : undefined });
}

export async function createAndSendEmailOTP(user: any): Promise<{ success: boolean; code?: string; error?: string }> {
  const code = generateOtp();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(emailVerifications).values({
    userId: user.id,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  const transporter = getTransport();
  const from = process.env.EMAIL_FROM || 'no-reply@containergenie.local';
  const appName = 'ContainerGenie';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:600px;margin:0 auto;">
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:20px;">
      <h2 style="color:#2d3748;margin:0;">${appName} - Password Reset</h2>
    </div>

    <div style="background:white;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin-top:0;">Hello ${user.name || ''},</p>

      <p>You have requested to reset your password. Here is your verification code:</p>

      <div style="background:#f7fafc;padding:20px;border-radius:6px;margin:20px 0;border-left:4px solid #4299e1;text-align:center;">
        <p style="margin:5px 0;font-size:18px;"><strong>Verification Code:</strong></p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:4px;color:#2d3748;margin:10px 0;">${code}</p>
      </div>

      <p style="color:#e53e3e;font-weight:bold;margin:20px 0;">⚠️ Important: Please change your password after first login for security.</p>

      <p>This code expires in 10 minutes. If you didn't request this password reset, please ignore this email.</p>

      <div style="margin:30px 0;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login"
           style="background:#4299e1;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
          Reset Your Password
        </a>
      </div>

      <p style="color:#718096;font-size:12px;margin-top:30px;">
        For security reasons, this code will expire in 10 minutes. Please use it promptly.
      </p>
    </div>
  </div>`;

  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️  SMTP not configured. Email verification code:', code);
      console.warn('📧 To enable email sending, configure SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
      return { success: false, code, error: 'Email not configured. Check server logs for verification code.' };
    }

    await transporter.sendMail({
      to: user.email,
      from,
      subject: `${appName} - Verify your email`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.warn('📧 Email verification code (not sent):', code);
    return { success: false, code, error: 'Email sending failed. Check server logs for verification code.' };
  }
}

export async function sendUserCredentials(user: any, plainPassword: string): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransport();
  const from = process.env.EMAIL_FROM || 'no-reply@containergenie.local';
  const appName = 'ContainerGenie';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:600px;margin:0 auto;">
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:20px;">
      <h2 style="color:#2d3748;margin:0;">${appName} - Your Account Credentials</h2>
    </div>

    <div style="background:white;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin-top:0;">Hello ${user.name},</p>

      <p>Your account has been created successfully. Here are your login credentials:</p>

      <div style="background:#f7fafc;padding:20px;border-radius:6px;margin:20px 0;border-left:4px solid #4299e1;">
        <p style="margin:5px 0;"><strong>Email:</strong> ${user.email}</p>
        <p style="margin:5px 0;"><strong>Password:</strong> ${plainPassword}</p>
      </div>

      <p style="color:#e53e3e;font-weight:bold;">⚠️ Important: Please change your password after first login for security.</p>

      <div style="margin:30px 0;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login"
           style="background:#4299e1;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
          Login to Your Account
        </a>
      </div>

      <p style="color:#718096;font-size:12px;margin-top:30px;">
        If you did not request this account, please contact your administrator.
      </p>
    </div>
  </div>`;

  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️  SMTP not configured. User credentials not sent via email.');
      console.warn('📧 User:', user.email, 'Password:', plainPassword);
      return { success: false, error: 'Email not configured. Check server logs for credentials.' };
    }

    await transporter.sendMail({
      to: user.email,
      from,
      subject: `${appName} - Your Account Credentials`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Credentials email sending failed:', error.message);
    return { success: false, error: 'Email sending failed.' };
  }
}

function generateSecurePassword(): string {
  // Generate a secure 12-character password
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export { generateSecurePassword };

export async function verifyEmailCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashCode(code);
  const now = new Date();

  // Get latest unexpired record
  const rows = await db.select().from(emailVerifications)
    .where(and(eq(emailVerifications.userId, userId)))
    .orderBy(emailVerifications.createdAt);

  const record = rows.reverse().find(r => new Date(r.expiresAt) > now);
  if (!record) return false;

  // Simple attempt limit
  if ((record.attempts || 0) >= 5) return false;

  if (record.codeHash !== codeHash) {
    await db.update(emailVerifications)
      .set({ attempts: (record.attempts || 0) + 1 })
      .where(eq(emailVerifications.id, record.id));
    return false;
  }

  // Success → mark emailVerified in caller
  return true;
}

// ============================================================================
// PASSWORD RESET TOKEN SYSTEM
// ============================================================================

/**
 * Generates a cryptographically secure random token
 * Returns 32 bytes (256 bits) as a hex string = 64 characters
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a token using SHA-256
 * We store only the hash, never the plain token
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a password reset token and stores its hash
 * Returns the plain token (to be sent via email) and token data
 *
 * @param userId - User ID to create reset token for
 * @param createdBy - Admin user ID who triggered the reset (optional)
 * @param ipAddress - IP address of the requester (optional)
 * @param userAgent - Browser/device info (optional)
 * @returns Object with plain token and token record
 */
export async function createPasswordResetToken(
  userId: string,
  createdBy?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; tokenRecord: any }> {
  const plainToken = generateResetToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Invalidate any existing unused tokens for this user
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.userId, userId),
      isNull(passwordResetTokens.usedAt)
    ));

  // Create new token
  const [tokenRecord] = await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
    createdBy,
    ipAddress,
    userAgent,
  }).returning();

  return { token: plainToken, tokenRecord };
}

/**
 * Validates a password reset token
 * Checks if token exists, is not expired, and hasn't been used
 *
 * @param token - Plain token from the reset link
 * @returns Token record if valid, null otherwise
 */
export async function validateResetToken(token: string): Promise<any | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [tokenRecord] = await db.select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash));

  if (!tokenRecord) {
    console.log('[PASSWORD RESET] Token not found');
    return null;
  }

  // Check if already used
  if (tokenRecord.usedAt) {
    console.log('[PASSWORD RESET] Token already used at', tokenRecord.usedAt);
    return null;
  }

  // Check if expired
  if (new Date(tokenRecord.expiresAt) < now) {
    console.log('[PASSWORD RESET] Token expired at', tokenRecord.expiresAt);
    return null;
  }

  return tokenRecord;
}

/**
 * Marks a reset token as used
 *
 * @param tokenHash - Hashed token to mark as used
 */
export async function markTokenAsUsed(tokenHash: string): Promise<void> {
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.tokenHash, tokenHash));
}

/**
 * Sends password reset email with secure link
 * BEST PRACTICE: Send a secure link instead of temporary password
 *
 * @param user - User object with email and name
 * @param resetToken - Plain reset token (not hashed)
 * @returns Success status and error if any
 */
export async function sendPasswordResetEmail(
  user: any,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransport();
  const from = process.env.EMAIL_FROM || 'no-reply@containergenie.local';
  const appName = 'ContainerGenie';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:600px;margin:0 auto;">
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:20px;">
      <h2 style="color:#2d3748;margin:0;">${appName} - Password Reset</h2>
    </div>

    <div style="background:white;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin-top:0;">Hello ${user.name || 'User'},</p>

      <p>Your password has been reset by an administrator. To set a new password, please click the button below:</p>

      <div style="margin:30px 0;text-align:center;">
        <a href="${resetLink}"
           style="background:#4299e1;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
          Set New Password
        </a>
      </div>

      <p style="color:#718096;font-size:12px;">
        Or copy and paste this link into your browser:<br>
        <a href="${resetLink}" style="color:#4299e1;word-break:break-all;">${resetLink}</a>
      </p>

      <div style="background:#fff3cd;padding:15px;border-radius:6px;margin:20px 0;border-left:4px solid #ffc107;">
        <p style="margin:0;color:#856404;">
          <strong>⚠️ Security Notice:</strong><br>
          • This link expires in 1 hour<br>
          • The link can only be used once<br>
          • Your email is your login ID: <strong>${user.email}</strong>
        </p>
      </div>

      <p style="color:#e53e3e;font-weight:bold;margin:20px 0;">
        If you did not request this password reset, please contact your administrator immediately.
      </p>

      <p style="color:#718096;font-size:12px;margin-top:30px;">
        For security reasons, this link will expire in 1 hour. Please use it promptly.
      </p>
    </div>

    <div style="text-align:center;margin-top:20px;color:#718096;font-size:12px;">
      <p>This is an automated message from ${appName}. Please do not reply to this email.</p>
    </div>
  </div>`;

  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️  SMTP not configured. Password reset link not sent via email.');
      console.warn('📧 User:', user.email);
      console.warn('🔗 Reset link:', resetLink);
      return { success: false, error: 'Email not configured. Check server logs for reset link.' };
    }

    await transporter.sendMail({
      to: user.email,
      from,
      subject: `${appName} - Password Reset Required`,
      html,
    });

    console.log('✅ Password reset email sent to', user.email);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Password reset email sending failed:', error.message);
    console.warn('🔗 Reset link (not sent):', resetLink);
    return { success: false, error: 'Email sending failed. Check server logs for reset link.' };
  }
}

/**
 * Sends welcome email with password reset link for new client onboarding
 * This is the secure alternative to sending temporary passwords
 *
 * @param user - User object with email and name
 * @param resetToken - Plain reset token (not hashed)
 * @returns Success status and error if any
 */
export async function sendWelcomeEmailWithResetLink(
  user: any,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransport();
  const from = process.env.EMAIL_FROM || 'no-reply@containergenie.local';
  const appName = 'ContainerGenie';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:600px;margin:0 auto;">
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:20px;">
      <h2 style="color:#2d3748;margin:0;">${appName} - Welcome!</h2>
    </div>

    <div style="background:white;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin-top:0;">Hello ${user.name || 'User'},</p>

      <p>Welcome to ${appName}! Your account has been created successfully.</p>

      <p>To get started, please set your password by clicking the button below:</p>

      <div style="margin:30px 0;text-align:center;">
        <a href="${resetLink}"
           style="background:#4299e1;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
          Set Your Password
        </a>
      </div>

      <p style="color:#718096;font-size:12px;">
        Or copy and paste this link into your browser:<br>
        <a href="${resetLink}" style="color:#4299e1;word-break:break-all;">${resetLink}</a>
      </p>

      <div style="background:#e7f5ff;padding:20px;border-radius:6px;margin:20px 0;border-left:4px solid #4299e1;">
        <p style="margin:0;color:#2d3748;">
          <strong>📧 Your Login ID:</strong> ${user.email}<br>
          <strong>🔐 Password:</strong> Set using the link above
        </p>
      </div>

      <div style="background:#fff3cd;padding:15px;border-radius:6px;margin:20px 0;border-left:4px solid #ffc107;">
        <p style="margin:0;color:#856404;">
          <strong>⚠️ Security Notice:</strong><br>
          • This link expires in 1 hour<br>
          • The link can only be used once<br>
          • Choose a strong password you haven't used elsewhere
        </p>
      </div>

      <p style="color:#718096;font-size:12px;margin-top:30px;">
        If you did not expect this email or have any questions, please contact your administrator.
      </p>
    </div>

    <div style="text-align:center;margin-top:20px;color:#718096;font-size:12px;">
      <p>This is an automated message from ${appName}. Please do not reply to this email.</p>
    </div>
  </div>`;

  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️  SMTP not configured. Welcome email not sent.');
      console.warn('📧 User:', user.email);
      console.warn('🔗 Password setup link:', resetLink);
      return { success: false, error: 'Email not configured. Check server logs for password setup link.' };
    }

    await transporter.sendMail({
      to: user.email,
      from,
      subject: `${appName} - Welcome! Set Your Password`,
      html,
    });

    console.log('✅ Welcome email with password reset link sent to', user.email);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Welcome email sending failed:', error.message);
    console.warn('🔗 Password setup link (not sent):', resetLink);
    return { success: false, error: 'Email sending failed. Check server logs for password setup link.' };
  }
}

/**
 * Logs security events to audit log
 *
 * @param userId - User ID affected by the action
 * @param action - Action performed (e.g., 'password_reset_requested')
 * @param performedBy - User ID who performed the action
 * @param details - Additional details as JSON
 * @param ipAddress - IP address of the requester
 */
export async function logSecurityEvent(
  userId: string,
  action: string,
  performedBy: string | null,
  details: any,
  ipAddress?: string
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: performedBy || userId,
      action,
      entityType: 'user',
      entityId: userId,
      changes: details,
      source: 'dashboard',
      ipAddress,
    });
    console.log(`[SECURITY AUDIT] ${action} for user ${userId}${performedBy ? ` by ${performedBy}` : ''}`);
  } catch (error: any) {
    console.error('❌ Failed to log security event:', error.message);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

/**
 * Cleans up expired and used tokens (can be run periodically)
 * Removes tokens older than 24 hours
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const deleted = await db.delete(passwordResetTokens)
    .where(lt(passwordResetTokens.createdAt, oneDayAgo))
    .returning();

  console.log(`🧹 Cleaned up ${deleted.length} expired password reset tokens`);
  return deleted.length;
}














