
import nodemailer from 'nodemailer';

// Check if SMTP is properly configured
const isSmtpConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
};

// Check if Mailgun is configured
const isMailgunConfigured = () => {
  return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
};

// Check if Gmail is configured via EMAIL_USER/PASS (Preferred for Gmail)
const isGmailConfigured = () => {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

// Configure SMTP transporter
let smtpTransporter: nodemailer.Transporter | null = null;

if (isGmailConfigured()) {
  smtpTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('✅ Email service configured with Gmail Service (using EMAIL_USER/EMAIL_PASS)');
} else if (isSmtpConfigured()) {
  smtpTransporter = nodemailer.createTransport({
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
  console.log('✅ Email service configured with SMTP (Google/Other)');
}

// Configure Mailgun transporter as fallback
let mailgunTransporter: nodemailer.Transporter | null = null;

if (isMailgunConfigured()) {
  mailgunTransporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    auth: {
      user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
      pass: process.env.MAILGUN_API_KEY
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  console.log('✅ Mailgun fallback email service configured');
}

// Log configuration status
if (!isGmailConfigured() && !isSmtpConfigured() && !isMailgunConfigured()) {
  console.warn('⚠️ No email service configured. Please set EMAIL_USER/EMAIL_PASS for Gmail, or SMTP_ details.');
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
  from?: string;
}

// Send email via Mailgun API directly (more reliable than SMTP)
async function sendViaMailgunApi({ to, subject, body, html, attachments, from }: EmailOptions): Promise<any> {
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const mailgunApiKey = process.env.MAILGUN_API_KEY;

  if (!mailgunDomain || !mailgunApiKey) {
    throw new Error('Mailgun not configured');
  }

  const formData = new FormData();
  formData.append('from', from || process.env.MAILGUN_FROM || `help@${mailgunDomain}`);
  formData.append('to', Array.isArray(to) ? to.join(',') : to);
  formData.append('subject', subject);
  formData.append('text', body);
  if (html) {
    formData.append('html', html);
  }

  // Handle attachments
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      if (attachment.content) {
        // Convert Buffer or string to ArrayBuffer for Blob compatibility
        let arrayBuffer: ArrayBuffer;
        if (Buffer.isBuffer(attachment.content)) {
          arrayBuffer = attachment.content.buffer.slice(
            attachment.content.byteOffset,
            attachment.content.byteOffset + attachment.content.byteLength
          ) as ArrayBuffer;
        } else if (typeof attachment.content === 'string') {
          arrayBuffer = new TextEncoder().encode(attachment.content).buffer as ArrayBuffer;
        } else {
          arrayBuffer = attachment.content as ArrayBuffer;
        }
        const blob = new Blob([arrayBuffer], { type: attachment.contentType || 'application/octet-stream' });
        formData.append('attachment', blob, attachment.filename);
      }
    }
  }

  const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Email sent via Mailgun API:', result.id);
  return { messageId: result.id, provider: 'mailgun-api' };
}

// Send email via SMTP (Mailgun SMTP)
async function sendViaMailgunSmtp(options: EmailOptions): Promise<any> {
  if (!mailgunTransporter) {
    throw new Error('Mailgun SMTP transporter not initialized');
  }

  const mailOptions = {
    from: options.from || process.env.MAILGUN_FROM || `help@${process.env.MAILGUN_DOMAIN}`,
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: options.html || options.body.replace(/\n/g, '<br>'),
    attachments: options.attachments
  };

  const info = await mailgunTransporter.sendMail(mailOptions);
  console.log('✅ Email sent via Mailgun SMTP:', info.messageId);
  return { ...info, provider: 'mailgun-smtp' };
}

// Send email via Google SMTP
async function sendViaGoogleSmtp(options: EmailOptions): Promise<any> {
  if (!smtpTransporter) {
    throw new Error('SMTP transporter not initialized');
  }

  const mailOptions = {
    from: options.from || process.env.EMAIL_FROM || 'noreply@servicehub.com',
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: options.html || options.body.replace(/\n/g, '<br>'),
    attachments: options.attachments
  };

  const info = await smtpTransporter.sendMail(mailOptions);
  console.log('✅ Email sent via Google SMTP:', info.messageId);
  return { ...info, provider: 'google-smtp' };
}

export async function sendEmail(options: EmailOptions) {
  const { to, subject, body, html, attachments, from } = options;

  // Skip email in development if not configured
  if (!isGmailConfigured() && !isSmtpConfigured() && !isMailgunConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Email skipped (no email service configured): ${subject} to ${to}`);
      return { messageId: 'dev-mock-id', skipped: true };
    } else {
      throw new Error('No email service configured. Please set EMAIL_USER/EMAIL_PASS, SMTP_ credentials, or Mailgun credentials.');
    }
  }

  const errors: string[] = [];

  // Try Mailgun API first (primary - most reliable)
  if (isMailgunConfigured()) {
    try {
      console.log('📧 Attempting to send email via Mailgun API...');
      const result = await sendViaMailgunApi(options);
      return result;
    } catch (error: any) {
      console.warn('⚠️ Mailgun API failed:', error.message);
      errors.push(`Mailgun API: ${error.message}`);
    }

    // Try Mailgun SMTP as second option
    if (mailgunTransporter) {
      try {
        console.log('📧 Attempting to send email via Mailgun SMTP (fallback)...');
        const result = await sendViaMailgunSmtp(options);
        return result;
      } catch (error: any) {
        console.warn('⚠️ Mailgun SMTP failed:', error.message);
        errors.push(`Mailgun SMTP: ${error.message}`);
      }
    }
  }

  // Fallback to Google SMTP / Gmail Service if configured
  if (smtpTransporter) {
    try {
      console.log('📧 Attempting to send email via SMTP/Gmail...');
      const result = await sendViaGoogleSmtp(options);
      console.log('✅ MAIL SENT SUCCESSFULLY to:', to);
      return result;
    } catch (error: any) {
      console.warn('⚠️ MAILER FAILED (SMTP/Gmail):', error.message);
      console.error('Full Error:', error);
      errors.push(`SMTP/Gmail: ${error.message}`);
    }
  }

  // All methods failed
  const errorMessage = `All email methods failed:\n${errors.join('\n')}`;
  console.error('❌ ' + errorMessage);

  // In development, don't throw - just log and return mock
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Email sending failed in development - continuing without email');
    return { messageId: 'mock-id-error', error: true, errors };
  }

  throw new Error(errorMessage);
}

// Export a function to send email specifically via Mailgun (for testing)
export async function sendEmailViaMailgun(options: EmailOptions) {
  if (!isMailgunConfigured()) {
    throw new Error('Mailgun not configured');
  }
  return sendViaMailgunApi(options);
}

// Export a function to test email configuration
export async function testEmailConfiguration(): Promise<{ smtp: boolean; mailgun: boolean; errors: string[] }> {
  const result = { smtp: false, mailgun: false, errors: [] as string[] };

  if (isSmtpConfigured() && smtpTransporter) {
    try {
      await smtpTransporter.verify();
      result.smtp = true;
      console.log('✅ Google SMTP connection verified');
    } catch (error: any) {
      result.errors.push(`SMTP: ${error.message}`);
      console.warn('⚠️ Google SMTP verification failed:', error.message);
    }
  }

  if (isMailgunConfigured()) {
    try {
      // Test Mailgun by checking domain info
      const response = await fetch(`https://api.mailgun.net/v3/domains/${process.env.MAILGUN_DOMAIN}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        },
      });
      if (response.ok) {
        result.mailgun = true;
        console.log('✅ Mailgun API connection verified');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      result.errors.push(`Mailgun: ${error.message}`);
      console.warn('⚠️ Mailgun verification failed:', error.message);
    }
  }

  return result;
}
