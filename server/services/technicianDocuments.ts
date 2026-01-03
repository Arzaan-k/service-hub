import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { sendEmail } from './emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

/**
 * Generate password setup token and send email to new technician
 */
export async function sendPasswordSetupEmail(technicianId: string) {
  try {
    const technician = await storage.getTechnician(technicianId);
    if (!technician) {
      throw new Error('Technician not found');
    }

    const user = await storage.getUser(technician.userId);
    if (!user || !user.email) {
      throw new Error('Technician email not found');
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to database
    await storage.updateTechnician(technicianId, {
      passwordSetupToken: token,
      passwordSetupTokenExpiry: tokenExpiry,
    });

    // Send email
    const setupUrl = `${CLIENT_URL}/technician/setup-password?token=${token}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Service Hub!</h2>
        
        <p>Hi ${user.name},</p>
        
        <p>You have been added as a technician to the Service Hub Management System.</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Employee Code:</strong> ${technician.employeeCode}</p>
          <p style="margin: 5px 0 0 0;"><strong>Email:</strong> ${user.email}</p>
        </div>
        
        <p><strong>To get started:</strong></p>
        <ol>
          <li>Click the button below to create your password</li>
          <li>Login with your credentials</li>
          <li>Upload required documents (Aadhar, Health Report, CBC Report, Insurance Report)</li>
          <li>Start receiving job assignments</li>
        </ol>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${setupUrl}" 
             style="background: #2563eb; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Create Password
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          <strong>Note:</strong> This link will expire in 24 hours.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          Service Hub Management System<br>
          If you did not expect this email, please ignore it.
        </p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to Service Hub - Create Your Password',
        body: 'Welcome to Service Hub! Please create your password to get started.',
        html: emailHtml,
      });
      console.log(`[TECHNICIAN DOCUMENTS] Password setup email sent to ${user.email}`);
    } catch (emailError: any) {
      // In development mode without email config, log but don't fail
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[TECHNICIAN DOCUMENTS] Email not sent (no email service configured) - would have sent to ${user.email}`);
        console.log(`[TECHNICIAN DOCUMENTS] Setup URL: ${setupUrl}`);
      } else {
        throw emailError;
      }
    }

    return { success: true, email: user.email, setupUrl };
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error sending password setup email:', error);
    throw error;
  }
}

/**
 * Verify password setup token
 */
export async function verifyPasswordSetupToken(token: string) {
  try {
    const technicians = await storage.getAllTechnicians();
    const technician = technicians.find(
      (t: any) => t.passwordSetupToken === token
    );

    if (!technician) {
      return { valid: false, error: 'Invalid token' };
    }

    if (!technician.passwordSetupTokenExpiry || new Date() > new Date(technician.passwordSetupTokenExpiry)) {
      return { valid: false, error: 'Token expired' };
    }

    const user = await storage.getUser(technician.userId);
    return {
      valid: true,
      technician: {
        id: technician.id,
        name: user?.name,
        employeeCode: technician.employeeCode,
        email: user?.email,
      },
    };
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error verifying token:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Setup password for technician
 */
export async function setupTechnicianPassword(token: string, password: string) {
  try {
    const verification = await verifyPasswordSetupToken(token);
    if (!verification.valid) {
      throw new Error(verification.error || 'Invalid token');
    }

    const technicians = await storage.getAllTechnicians();
    const technician = technicians.find(
      (t: any) => t.passwordSetupToken === token
    );

    if (!technician) {
      throw new Error('Technician not found');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with password
    await storage.updateUser(technician.userId, {
      password: hashedPassword,
      requiresPasswordReset: false,
    });

    // Clear token
    await storage.updateTechnician(technician.id, {
      passwordSetupToken: null,
      passwordSetupTokenExpiry: null,
    });

    // Generate JWT token for auto-login
    const user = await storage.getUser(technician.userId);
    const jwtToken = jwt.sign(
      { id: user!.id, role: user!.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[TECHNICIAN DOCUMENTS] Password setup completed for technician ${technician.id}`);

    return {
      success: true,
      token: jwtToken,
      technician: {
        id: technician.id,
        userId: technician.userId,
        name: user!.name,
        email: user!.email,
        employeeCode: technician.employeeCode,
        documentsSubmitted: technician.documentsSubmitted || false,
      },
    };
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error setting up password:', error);
    throw error;
  }
}

/**
 * Get document status for a technician
 */
export async function getTechnicianDocumentStatus(technicianId: string) {
  try {
    const documents = await storage.getTechnicianDocuments(technicianId);
    
    return {
      uploadedCount: documents.length,
      totalRequired: 4,
      documents: documents,
      isComplete: documents.length === 4,
      missingDocuments: getMissingDocuments(documents),
    };
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error getting document status:', error);
    throw error;
  }
}

/**
 * Get missing document types
 */
function getMissingDocuments(documents: any[]) {
  const requiredTypes = ['aadhar', 'health_report', 'cbc_report', 'insurance_report'];
  const uploadedTypes = documents.map(d => d.documentType);
  return requiredTypes.filter(type => !uploadedTypes.includes(type));
}

/**
 * Send document reminder email to technician
 */
export async function sendDocumentReminderEmail(technicianId: string) {
  try {
    console.log(`[TECHNICIAN DOCUMENTS] Fetching technician ${technicianId}...`);
    const technician = await storage.getTechnician(technicianId);
    if (!technician) {
      console.error(`[TECHNICIAN DOCUMENTS] Technician not found: ${technicianId}`);
      throw new Error('Technician not found');
    }
    console.log(`[TECHNICIAN DOCUMENTS] Technician found: ${technician.userId}`);

    const user = await storage.getUser(technician.userId);
    if (!user) {
      console.error(`[TECHNICIAN DOCUMENTS] User not found for technician: ${technician.userId}`);
      throw new Error('Technician user not found');
    }
    if (!user.email) {
      console.error(`[TECHNICIAN DOCUMENTS] User has no email: ${user.id}`);
      throw new Error('Technician email not found');
    }
    console.log(`[TECHNICIAN DOCUMENTS] User email: ${user.email}`);

    const documents = await storage.getTechnicianDocuments(technicianId);
    console.log(`[TECHNICIAN DOCUMENTS] Documents count: ${documents.length}`);
    const uploadUrl = `${CLIENT_URL}/technician/submit-documents`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Action Required: Upload Your Documents</h2>
        
        <p>Hi ${user.name},</p>
        
        <p>We noticed that your document submission is incomplete. To continue receiving job assignments, please upload the following required documents:</p>
        
        <ul style="background: #fff7ed; padding: 20px; border-left: 4px solid #ea580c;">
          <li><strong>Aadhar Card</strong></li>
          <li><strong>Health Report</strong></li>
          <li><strong>CBC Report</strong></li>
          <li><strong>Insurance Report</strong></li>
        </ul>
        
        <p>Current Status: <strong>${documents.length}/4 documents uploaded</strong></p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${uploadUrl}" 
             style="background: #ea580c; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Upload Documents Now
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          If you have any questions, please contact your administrator.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          Service Hub Management System
        </p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Action Required: Upload Your Documents - Service Hub',
        body: 'Please upload your required documents to complete your profile.',
        html: emailHtml,
      });
      console.log(`[TECHNICIAN DOCUMENTS] Reminder email sent to ${user.email}`);
    } catch (emailError: any) {
      // In development mode without email config, log but don't fail
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[TECHNICIAN DOCUMENTS] Email not sent (no email service configured) - would have sent to ${user.email}`);
        console.log(`[TECHNICIAN DOCUMENTS] Email content: ${emailHtml.substring(0, 200)}...`);
      } else {
        throw emailError;
      }
    }

    return { success: true, email: user.email };
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error sending reminder email:', error);
    throw error;
  }
}

/**
 * Send bulk document reminders to all technicians with incomplete documents
 */
export async function sendBulkDocumentReminders() {
  try {
    const technicians = await storage.getAllTechnicians();
    const techniciansWithIncompleteDocuments = [];

    for (const tech of technicians) {
      const documents = await storage.getTechnicianDocuments(tech.id);
      if (documents.length < 4) {
        techniciansWithIncompleteDocuments.push(tech);
      }
    }

    const results = [];
    for (const tech of techniciansWithIncompleteDocuments) {
      try {
        await sendDocumentReminderEmail(tech.id);
        results.push({ technicianId: tech.id, success: true });
      } catch (error) {
        results.push({ technicianId: tech.id, success: false, error });
      }
    }

    console.log(`[TECHNICIAN DOCUMENTS] Sent ${results.filter(r => r.success).length}/${techniciansWithIncompleteDocuments.length} reminder emails`);

    return {
      success: true,
      totalSent: results.filter(r => r.success).length,
      totalTechnicians: techniciansWithIncompleteDocuments.length,
      results,
    };
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error sending bulk reminders:', error);
    throw error;
  }
}

/**
 * Get document label from type
 */
export function getDocumentLabel(documentType: string): string {
  const labels: Record<string, string> = {
    aadhar: 'Aadhar Card',
    health_report: 'Health Report',
    cbc_report: 'CBC Report',
    insurance_report: 'Insurance Report',
  };
  return labels[documentType] || documentType;
}
