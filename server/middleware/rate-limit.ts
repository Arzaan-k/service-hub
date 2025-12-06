import rateLimit from 'express-rate-limit';

/**
 * [SECURITY] Strict rate limit for authentication endpoints
 * Prevents brute force attacks on login/registration
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: 15 * 60, // seconds
      message: 'Please try again in 15 minutes'
    });
  },
});

/**
 * [SECURITY] General API rate limit
 * Applies to all API routes to prevent abuse
 */
export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: 'Too many requests from this IP. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] API rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
      message: 'Too many requests. Please try again later.'
    });
  },
});

/**
 * [SECURITY] Strict limit for expensive operations
 * Used for AI/RAG queries, bulk operations, report generation
 */
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many requests for this resource. This operation is rate-limited.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] Expensive operation rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      error: 'Rate limit exceeded for expensive operation',
      retryAfter: 3600, // 1 hour in seconds
      message: 'This operation is limited to 10 requests per hour'
    });
  },
});

/**
 * [SECURITY] WhatsApp webhook rate limit
 * Allows high throughput for incoming webhook messages
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow bursts of messages
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.error(`[RATE LIMIT] WhatsApp webhook rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Webhook rate limit exceeded',
      retryAfter: 60
    });
  },
});

/**
 * [SECURITY] File upload rate limit
 * Prevents DoS via large file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: 'Too many file uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] File upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Upload rate limit exceeded',
      retryAfter: 900,
      message: 'Too many file uploads. Maximum 10 per 15 minutes.'
    });
  },
});
