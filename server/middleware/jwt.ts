import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('[JWT] WARNING: JWT_SECRET is not set or is too short. Please set a secure JWT_SECRET (minimum 32 characters) in .env');
}

export interface JWTPayload {
  userId: string;
  role: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

/**
 * Generate an access token for authenticated requests
 * @param userId User ID
 * @param role User role
 * @param sessionId Session identifier
 * @returns JWT access token
 */
export function generateAccessToken(userId: string, role: string, sessionId: string): string {
  return jwt.sign(
    { userId, role, sessionId, type: 'access' } as JWTPayload,
    JWT_SECRET,
    {
      expiresIn: JWT_ACCESS_EXPIRY,
      issuer: 'service-hub',
      audience: 'service-hub-api'
    }
  );
}

/**
 * Generate a refresh token for obtaining new access tokens
 * @param userId User ID
 * @param role User role
 * @param sessionId Session identifier
 * @returns JWT refresh token
 */
export function generateRefreshToken(userId: string, role: string, sessionId: string): string {
  return jwt.sign(
    { userId, role, sessionId, type: 'refresh' } as JWTPayload,
    JWT_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRY,
      issuer: 'service-hub',
      audience: 'service-hub-api'
    }
  );
}

/**
 * Verify and decode a JWT token
 * @param token JWT token string
 * @param expectedType Expected token type ('access' or 'refresh')
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string, expectedType: 'access' | 'refresh'): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'service-hub',
      audience: 'service-hub-api',
    }) as JWTPayload;

    if (payload.type !== expectedType) {
      console.warn(`[JWT] Token type mismatch: expected ${expectedType}, got ${payload.type}`);
      return null;
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.debug('[JWT] Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('[JWT] Invalid token:', error.message);
    } else {
      console.error('[JWT] Token verification failed:', error);
    }
    return null;
  }
}

/**
 * Generate a secure random session ID
 * @returns Random UUID v4 session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}
