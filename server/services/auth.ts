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

export async function createAndSendEmailOTP(user: any): Promise<void> {
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

  await transporter.sendMail({
    to: user.email,
    from,
    subject: `${appName} - Verify your email`,
    html,
  });
}

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









