/**
 * [SECURITY] Structured logging with PII redaction
 * Prevents sensitive data (passwords, tokens, phone numbers) from appearing in logs
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    const configuredLevel = (process.env.LOG_LEVEL || 'INFO') as LogLevel;
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(configuredLevel);
  }

  /**
   * Sanitize data to remove sensitive information
   */
  private sanitize(data: any): any {
    if (!data) return data;

    // List of sensitive field names
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apikey',
      'api_key',
      'authorization',
      'auth',
      'cookie',
      'session',
      'sessionid',
      'creditcard',
      'credit_card',
      'ssn',
      'privatekey',
      'private_key',
      'accesstoken',
      'access_token',
      'refreshtoken',
      'refresh_token',
    ];

    if (typeof data === 'string') {
      // Redact phone numbers (various formats)
      let sanitized = data.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');
      // Redact email addresses
      sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***');
      // Redact credit card numbers
      sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****');
      return sanitized;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const keyLower = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(sk => keyLower.includes(sk.toLowerCase()));

        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Format log entry as JSON for structured logging
   */
  private log(level: LogLevel, message: string, meta?: any) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? this.sanitize(meta) : {};

    const logEntry = {
      timestamp,
      level,
      message,
      ...sanitizedMeta,
    };

    const output = JSON.stringify(logEntry);

    // Use appropriate console method
    if (level === LogLevel.ERROR) {
      console.error(output);
    } else if (level === LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Log error message with context
   */
  error(message: string, meta?: any) {
    this.log(LogLevel.ERROR, message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any) {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any) {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, meta?: any) {
    this.log(LogLevel.DEBUG, message, meta);
  }
}

export const logger = new Logger();

/**
 * Express middleware for request logging
 * Logs all incoming requests with method, path, status, and duration
 */
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    // Only log API requests
    if (req.path.startsWith("/api")) {
      logger.info('API Request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id,
        ip: req.ip,
      });
    }
  });

  next();
}
