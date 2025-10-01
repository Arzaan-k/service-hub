import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface WhatsAppAuthRequest extends Request {
  whatsappUser?: any;
  isAuthorized: boolean;
}

export async function whatsappAuthMiddleware(
  req: WhatsAppAuthRequest, 
  res: Response, 
  next: NextFunction
) {
  const phoneNumber = req.body.phoneNumber || req.query.phoneNumber;

  if (!phoneNumber) {
    req.isAuthorized = false;
    return next();
  }

  try {
    const user = await storage.getUserByPhone(phoneNumber as string);
    
    if (!user) {
      // Unknown number - log security event
      await storage.createAuditLog({
        action: 'UNAUTHORIZED_WHATSAPP_ACCESS',
        entityType: 'whatsapp_message',
        source: 'whatsapp',
        metadata: { phoneNumber },
        ipAddress: req.ip
      });

      req.isAuthorized = false;
      req.whatsappUser = null;
      return next();
    }

    // User found - attach to request
    req.whatsappUser = user;
    req.isAuthorized = true;
    
    // Log successful auth
    await storage.createAuditLog({
      userId: user.id,
      action: 'WHATSAPP_MESSAGE_RECEIVED',
      entityType: 'whatsapp_message',
      source: 'whatsapp',
      metadata: { phoneNumber },
      ipAddress: req.ip
    });

    next();
  } catch (error) {
    console.error('WhatsApp auth middleware error:', error);
    req.isAuthorized = false;
    next();
  }
}

export function requireWhatsAppAuth(
  req: WhatsAppAuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.isAuthorized || !req.whatsappUser) {
    return res.status(200).json({
      message: 'unauthorized',
      response: 'This number is not registered. Please contact support for registration.'
    });
  }
  next();
}

export function checkWhatsAppPermission(action: string) {
  return (req: WhatsAppAuthRequest, res: Response, next: NextFunction) => {
    if (!req.whatsappUser) {
      return res.status(200).json({
        message: 'unauthorized',
        response: 'Permission denied.'
      });
    }

    const role = req.whatsappUser.role;
    
    // Define permissions
    const permissions: Record<string, string[]> = {
      'view_containers': ['admin', 'client', 'technician'],
      'create_service_request': ['admin', 'client'],
      'update_service_status': ['admin', 'technician'],
      'view_invoices': ['admin', 'client'],
      'manage_schedule': ['admin', 'service_coordinator']
    };

    if (!permissions[action]?.includes(role)) {
      return res.status(200).json({
        message: 'forbidden',
        response: 'You do not have permission to perform this action.'
      });
    }

    next();
  };
}
