import express from 'express';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';

const router = express.Router();

/**
 * POST /auth/login
 * Central authentication endpoint - validates credentials and issues JWT
 * This is the SINGLE SOURCE OF TRUTH for authentication
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        console.log(`🔐 Service Hub: Login attempt for ${email}`);

        // Get user from storage
        const user = await storage.getUserByEmail(email);

        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if account is active (emailVerified is used as is_active in Service Hub)
        if (!user.emailVerified) {
            console.log(`❌ Account not verified: ${email}`);
            return res.status(403).json({ error: 'Account is disabled. Please contact your administrator.' });
        }

        // Check if password hash exists
        if (!user.password) {
            console.log(`❌ No password set for: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password using Service Hub's auth service
        const { comparePasswords } = await import('../services/auth');
        const isValidPassword = await comparePasswords(password, user.password);

        if (!isValidPassword) {
            console.log(`❌ Invalid password for: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token with standardized payload
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            process.env.JWT_SECRET || '',
            { expiresIn: '24h' }
        );

        console.log(`✅ Login successful: ${email} (${user.role})`);

        // Return token and user info
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.name.split(' ')[0] || user.name,
                lastName: user.name.split(' ').slice(1).join(' ') || '',
                name: user.name,
                role: user.role
            }
        });
    } catch (error: any) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /auth/me
 * Validate JWT token and return user information
 * Used by other systems to verify tokens
 */
router.get('/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token required' });
    }

    try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;

        // Get user from storage
        const user = await storage.getUser(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if account is still active (immediate revocation)
        if (!user.emailVerified) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        // Return user information
        res.json({
            userId: user.id,
            email: user.email,
            firstName: user.name.split(' ')[0] || user.name,
            lastName: user.name.split(' ').slice(1).join(' ') || '',
            name: user.name,
            role: user.role,
            isActive: user.emailVerified
        });
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        console.error('Token validation error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /auth/user/:userId
 * Get user information by ID (requires valid JWT)
 */
router.get('/user/:userId', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token required' });
    }

    try {
        // Verify requester's token
        jwt.verify(token, process.env.JWT_SECRET || '');

        const { userId } = req.params;

        // Get requested user from storage
        const user = await storage.getUser(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            userId: user.id,
            email: user.email,
            firstName: user.name.split(' ')[0] || user.name,
            lastName: user.name.split(' ').slice(1).join(' ') || '',
            name: user.name,
            role: user.role,
            isActive: user.emailVerified
        });
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        console.error('Get user error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export { router as authRouter };
