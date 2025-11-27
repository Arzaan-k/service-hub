
import nodemailer from 'nodemailer';

// Check if SMTP is properly configured
const isSmtpConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
};

// Configure transporter only if SMTP is configured
let transporter: nodemailer.Transporter | null = null;

if (isSmtpConfigured()) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 5000,
    socketTimeout: 10000, // 10 seconds
  });
  console.log('✅ Email service configured with SMTP');
} else {
  console.warn('⚠️ Email service not configured - SMTP credentials missing. Emails will be skipped in development mode.');
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({ to, subject, body, html, attachments }: EmailOptions) {
  // Skip email in development if not configured
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Email skipped (SMTP not configured): ${subject} to ${to}`);
      return { messageId: 'dev-mock-id', skipped: true };
    } else {
      throw new Error('SMTP not configured. Please set SMTP_USER, SMTP_PASS, and SMTP_HOST environment variables.');
    }
  }

  if (!transporter) {
    throw new Error('Email transporter not initialized');
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@servicehub.com',
      to,
      subject,
      text: body, // Plain text body
      html: html || body.replace(/\n/g, '<br>'), // Fallback HTML
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // In development, don't throw - just log and return mock
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Email sending failed in development - continuing without email');
      return { messageId: 'mock-id-error', error: true };
    }
    throw error;
  }
}
