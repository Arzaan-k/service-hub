
import nodemailer from 'nodemailer';

// Configure transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

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
  try {
    // Verify connection config
    // await transporter.verify();

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@servicehub.com',
      to,
      subject,
      text: body, // Plain text body
      html: html || body.replace(/\n/g, '<br>'), // Fallback HTML
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw in dev mode if credentials are missing
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER) {
        console.warn('Email sending skipped (no credentials)');
        return { messageId: 'mock-id' };
    }
    throw error;
  }
}
