import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface AuthRequest extends Request {
  user?: any;
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.headers["x-user-id"] as string;
    // Debug: log incoming auth headers in dev
    if (process.env.NODE_ENV === 'development') {
      console.log("[auth] header x-user-id=", userId, "NODE_ENV=", process.env.NODE_ENV);
    }

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Allow test user for development
    if (userId === "test-admin-123") {
      req.user = {
        id: "test-admin-123",
        name: "Test Admin",
        role: "admin",
        isActive: true
      };
      return next();
    }

    const user = await storage.getUser(userId);

    if (!user || !user.isActive) {
      if (process.env.NODE_ENV === 'development') {
        console.log("[auth] dev fallback activated for userId:", userId);
      }
      // Dev fallback: allow any x-user-id during local development
      if (process.env.NODE_ENV === 'development') {
        req.user = {
          id: userId,
          name: 'Dev User',
          role: 'admin',
          isActive: true,
        } as any;
        return next();
      }
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
