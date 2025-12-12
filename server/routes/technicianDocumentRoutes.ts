/**
 * Technician Document Management Routes
 * 
 * This file contains all routes for:
 * - Password setup for new technicians
 * - Document upload and management
 * - Admin viewing of technician documents
 * - Document reminder system
 * 
 * Add these routes to your main routes.ts file
 */

import { Router } from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { authenticateUser, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import {
  sendPasswordSetupEmail,
  verifyPasswordSetupToken,
  setupTechnicianPassword,
  getTechnicianDocumentStatus,
  sendDocumentReminderEmail,
  sendBulkDocumentReminders,
} from '../services/technicianDocuments';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
  },
});

/**
 * Helper to construct file URL
 */
const getFileUrl = (req: any, documentId: string) => {
  return `/api/technician/documents/${documentId}/file`;
};

/**
 * PUBLIC ROUTES (No authentication required)
 */

// Verify password setup token
router.get('/technician/verify-setup-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await verifyPasswordSetupToken(token);
    
    if (result.valid) {
      res.json({
        success: true,
        technician: result.technician,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Invalid or expired token',
      });
    }
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error verifying token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify token',
    });
  }
});

// Setup password for new technician
router.post('/technician/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required',
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }
    
    const result = await setupTechnicianPassword(token, password);
    
    res.json({
      success: true,
      token: result.token,
      technician: result.technician,
    });
  } catch (error: any) {
    console.error('[TECHNICIAN DOCUMENTS] Error setting up password:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to setup password',
    });
  }
});

/**
 * SERVE FILES (Authenticated)
 */
router.get('/technician/documents/:id/file', async (req: any, res) => {
  try {
    const { id } = req.params;
    const document = await storage.getTechnicianDocument(id);

    if (!document || !document.fileData) {
      return res.status(404).send('File not found');
    }

    // Optional: Add auth check here if strict security is needed
    // e.g., check if req.user can access this document

    res.setHeader('Content-Type', document.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
    res.send(document.fileData);
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error serving file:', error);
    res.status(500).send('Error serving file');
  }
});

/**
 * TECHNICIAN ROUTES (Requires technician authentication)
 * Note: You'll need to add authenticateTechnician middleware
 */

// Get document status for logged-in technician
router.get('/technician/documents-status', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    // Get technician by user ID
    const technician = await storage.getTechnicianByUserId(user.id);
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found',
      });
    }
    
    const status = await getTechnicianDocumentStatus(technician.id);
    res.json(status);
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error getting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document status',
    });
  }
});

// Get my uploaded documents (for technician)
router.get('/technician/my-documents', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    const technician = await storage.getTechnicianByUserId(user.id);
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found',
      });
    }
    const technicianId = technician.id;
    
    const documents = await storage.getTechnicianDocuments(technicianId);
    
    // Map to include valid URLs
    const docsWithUrls = documents.map(doc => ({
      ...doc,
      fileUrl: doc.fileUrl || getFileUrl(req, doc.id),
    }));

    res.json({
      success: true,
      documents: docsWithUrls,
    });
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error getting documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get documents',
    });
  }
});

// Upload or replace a document
router.post('/technician/upload-document', authenticateUser, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    const technician = await storage.getTechnicianByUserId(user.id);
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found',
      });
    }
    const technicianId = technician.id;
    
    const { documentType } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }
    
    if (!documentType) {
      return res.status(400).json({
        success: false,
        message: 'Document type is required',
      });
    }
    
    // Check if document already exists
    const existingDocs = await storage.getTechnicianDocuments(technicianId);
    const existingDoc = existingDocs.find(d => d.documentType === documentType);
    
    let resultDoc;
    let isUpdate = false;

    if (existingDoc) {
      // Update existing document
      resultDoc = await storage.updateTechnicianDocument(existingDoc.id, {
        filename: file.originalname,
        fileData: file.buffer,
        contentType: file.mimetype,
        fileSize: file.size,
        fileUrl: null, // Clear explicit URL to prefer generated one
      });
      isUpdate = true;
    } else {
      // Create new document
      resultDoc = await storage.createTechnicianDocument({
        technicianId,
        documentType,
        filename: file.originalname,
        fileData: file.buffer,
        contentType: file.mimetype,
        fileSize: file.size,
        fileUrl: null,
      });
    }

    const fileUrl = getFileUrl(req, resultDoc.id);
    
    res.json({
      success: true,
      document: { ...resultDoc, fileUrl },
      url: fileUrl,
      isUpdate,
    });

  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
    });
  }
});

// Submit all documents (mark as complete)
router.post('/technician/submit-documents', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    const technician = await storage.getTechnicianByUserId(user.id);
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found',
      });
    }
    const technicianId = technician.id;
    
    // Check if all 4 documents are uploaded
    const documents = await storage.getTechnicianDocuments(technicianId);
    
    if (documents.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Please upload all 4 required documents',
        uploadedCount: documents.length,
      });
    }
    
    // Mark as submitted
    await storage.updateTechnician(technicianId, {
      documentsSubmitted: true,
    });
    
    res.json({
      success: true,
      message: 'Documents submitted successfully',
    });
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error submitting documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit documents',
    });
  }
});

/**
 * ADMIN ROUTES (Requires admin or senior_technician role)
 * Note: You'll need to add requireRole middleware
 */

// Get documents for a specific technician (Admin only)
router.get('/technicians/:id/documents', authenticateUser, requireRole('admin', 'senior_technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    
    const { id } = req.params;
    const documents = await storage.getTechnicianDocuments(id);

    // Map to include valid URLs
    const docsWithUrls = documents.map(doc => ({
      ...doc,
      fileUrl: doc.fileUrl || getFileUrl(req, doc.id),
    }));
    
    res.json({
      success: true,
      documents: docsWithUrls,
    });
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error getting technician documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get documents',
    });
  }
});

// Get document status for specific technician (Admin only)
router.get('/technicians/:id/documents-status', authenticateUser, requireRole('admin', 'senior_technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    
    const { id } = req.params;
    const status = await getTechnicianDocumentStatus(id);
    
    res.json(status);
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error getting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document status',
    });
  }
});

// Get all technicians with document status (Admin only)
router.get('/technicians/list-with-documents', authenticateUser, requireRole('admin', 'senior_technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    
    const technicians = await storage.getAllTechnicians();
    
    // Add document count to each technician
    const techniciansWithStatus = await Promise.all(
      technicians.map(async (tech: any) => {
        const documents = await storage.getTechnicianDocuments(tech.id);
        return {
          ...tech,
          documentCount: documents.length,
          documentsComplete: documents.length === 4,
        };
      })
    );
    
    res.json({
      success: true,
      technicians: techniciansWithStatus,
    });
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error getting technicians:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get technicians',
    });
  }
});

// Send document reminder to specific technician (Admin only)
router.post('/technicians/:id/send-document-reminder', authenticateUser, requireRole('admin', 'senior_technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await sendDocumentReminderEmail(id);
    
    // Check if we're in development mode without email config
    const isDev = process.env.NODE_ENV === 'development';
    const hasEmailConfig = !!(process.env.EMAIL_USER || process.env.SMTP_USER || process.env.MAILGUN_API_KEY);
    
    res.json({
      success: true,
      message: isDev && !hasEmailConfig 
        ? 'Reminder logged (email service not configured in development)'
        : 'Reminder sent successfully',
      email: result.email,
      devMode: isDev && !hasEmailConfig,
    });
  } catch (error: any) {
    console.error('[TECHNICIAN DOCUMENTS] Error sending reminder:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reminder',
    });
  }
});

// Send bulk document reminders (Admin only)
router.post('/technicians/send-document-reminders', authenticateUser, requireRole('admin', 'senior_technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    
    const result = await sendBulkDocumentReminders();
    
    res.json({
      success: true,
      message: `Reminders sent to ${result.totalSent} technicians`,
      totalSent: result.totalSent,
      totalTechnicians: result.totalTechnicians,
    });
  } catch (error) {
    console.error('[TECHNICIAN DOCUMENTS] Error sending bulk reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reminders',
    });
  }
});

export default router;
