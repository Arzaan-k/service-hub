import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface AuthRequest extends Request {
  user?: any;
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await storage.getUser(userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or inactive user" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (roles.length > 0) {
      const userRole = (req.user.role || "client").toLowerCase();
      const allowed = roles.map(r => r.toLowerCase()).includes(userRole);
      if (!allowed) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    next();
  };
}

// WhatsApp message authorization middleware
export async function authorizeWhatsAppMessage(phoneNumber: string): Promise<{ authorized: boolean; user?: any; error?: string }> {
  try {
    const user = await storage.getUserByPhoneNumber(phoneNumber);

    if (!user) {
      return {
        authorized: false,
        error: "Phone number not registered. Please contact support to register.",
      };
    }

    if (!user.isActive) {
      return {
        authorized: false,
        error: "Your account is inactive. Please contact support.",
      };
    }

    if (!user.whatsappVerified) {
      // Auto-verify on first message
      await storage.updateUser(user.id, { whatsappVerified: true });
    }

    return {
      authorized: true,
      user,
    };
  } catch (error) {
    console.error("WhatsApp authorization error:", error);
    return {
      authorized: false,
      error: "Authorization failed. Please try again.",
    };
  }
}
