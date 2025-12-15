import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import type { Request, Response } from 'express';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    name?: string;
  };
}

// Middleware to authenticate user
const authenticateUser = (req: AuthRequest, res: Response, next: any) => {
  const userId = req.headers['x-user-id'] as string;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  
  // In a real app, you'd fetch the user from the database
  // For now, we'll attach the userId and assume role from the request
  req.user = {
    id: userId,
    role: req.headers['x-user-role'] as string || 'client'
  };
  
  next();
};

// Middleware to authenticate admin
const authenticateAdmin = (req: AuthRequest, res: Response, next: any) => {
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  
  req.user = {
    id: userId,
    role: userRole
  };
  
  next();
};

// Upload training material (Admin only)
router.post('/training/upload', 
  authenticateAdmin, 
  upload.single('file'), 
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, category, forClient, forTechnician } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }
      
      // Check if at least one role is selected
      const isForClient = forClient === 'true' || forClient === true;
      const isForTechnician = forTechnician === 'true' || forTechnician === true;
      
      if (!isForClient && !isForTechnician) {
        return res.status(400).json({ success: false, message: 'Please select at least one target role' });
      }
      
      // Determine file type
      let fileType = 'document';
      if (file.mimetype.startsWith('image/')) fileType = 'image';
      else if (file.mimetype.startsWith('video/')) fileType = 'video';
      else if (file.mimetype === 'application/pdf') fileType = 'pdf';
      
      const material = await storage.createTrainingMaterial({
        title: title.trim(),
        description: description?.trim() || null,
        category: category || null,
        fileType,
        fileName: file.originalname,
        fileData: file.buffer,
        fileSize: file.size,
        contentType: file.mimetype,
        forClient: isForClient,
        forTechnician: isForTechnician,
        uploadedBy: req.user!.id
      });
      
      console.log('[Training] Material uploaded:', material.id, material.title);
      
      res.json({ success: true, material });
    } catch (error) {
      console.error('[Training] Upload error:', error);
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

// Get materials for current user (Client/Technician)
router.get('/training/my-materials', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user!.role;
    const materials = await storage.getTrainingMaterialsForRole(userRole, req.user!.id);
    
    res.json({ success: true, materials });
  } catch (error) {
    console.error('[Training] Error fetching materials:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch materials' });
  }
});

// Get unread count
router.get('/training/unread-count', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const count = await storage.getUnreadTrainingCount(req.user!.id, req.user!.role);
    res.json({ success: true, count });
  } catch (error) {
    console.error('[Training] Error getting unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to get count' });
  }
});

// Mark material as viewed
router.post('/training/materials/:id/view', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    await storage.markTrainingAsViewed(req.params.id, req.user!.id, req.user!.role);
    res.json({ success: true });
  } catch (error) {
    console.error('[Training] Error marking as viewed:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as viewed' });
  }
});

// Serve file
router.get('/training/materials/:id/file', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const material = await storage.getTrainingMaterialFile(req.params.id);
    
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    res.set({
      'Content-Type': material.contentType,
      'Content-Length': material.fileSize,
      'Content-Disposition': req.query.download 
        ? `attachment; filename="${material.fileName}"` 
        : `inline; filename="${material.fileName}"` 
    });
    
    res.send(material.fileData);
  } catch (error) {
    console.error('[Training] Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Get all materials (Admin only)
router.get('/training/materials', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const materials = await storage.getAllTrainingMaterials();
    res.json({ success: true, materials });
  } catch (error) {
    console.error('[Training] Error fetching all materials:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch materials' });
  }
});

// Delete material (Admin only)
router.delete('/training/materials/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteTrainingMaterial(req.params.id);
    console.log('[Training] Material deleted:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Training] Error deleting material:', error);
    res.status(500).json({ success: false, error: 'Failed to delete material' });
  }
});

// Update material (Admin only)
router.put('/training/materials/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, forClient, forTechnician } = req.body;
    
    const updated = await storage.updateTrainingMaterial(req.params.id, {
      title,
      description,
      category,
      forClient,
      forTechnician
    });
    
    console.log('[Training] Material updated:', req.params.id);
    res.json({ success: true, material: updated });
  } catch (error) {
    console.error('[Training] Error updating material:', error);
    res.status(500).json({ success: false, error: 'Failed to update material' });
  }
});

export default router;
