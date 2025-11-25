import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { db } from '../db';
import { emailVerifications, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

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
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
    <h2>${appName} - Email Verification</h2>
    <p>Hello ${user.name || ''},</p>
    <p>Your verification code is:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>This code expires in 10 minutes.</p>
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














