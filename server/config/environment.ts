/**
 * Environment Configuration Module
 *
 * [SECURITY] Type-safe access to environment variables
 * [ROBUSTNESS] Validates required config at startup
 * [CONFIGURATION] Central source of truth
 */

export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  database: {
    url: string;
  };
  orbcomm: {
    url: string;
    username: string;
    password: string;
    enabled: boolean;
  };
  whatsapp: {
    phoneNumberId: string;
    accessToken: string;
    webhookToken: string;
    appId: string;
    appSecret: string;
    graphApiVersion: string;
    wabaId: string;
  };
  googleAI: {
    apiKey: string;
  };
  security: {
    jwtSecret: string;
    jwtAccessExpiry: string;
    jwtRefreshExpiry: string;
    sessionSecret: string;
    encryptionKey: string;
    corsOrigins: string[];
    bcryptSaltRounds: number;
    enableRateLimiting: boolean;
    enableCsrfProtection: boolean;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    from: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    sentryDsn?: string;
    enableDetailedErrors: boolean;
  };
  features: {
    enableWhatsApp: boolean;
    enableOrbcomm: boolean;
    enableExternalInventory: boolean;
  };
}

/**
 * [SECURITY] Parse CORS origins from environment variable
 * Returns array of allowed origins or true for development
 */
function parseCorsOrigins(): string[] {
  if (process.env.NODE_ENV === 'development') {
    // In development, allow localhost variants
    return ['http://localhost:5000', 'http://localhost:3000', 'http://127.0.0.1:5000'];
  }

  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins) {
    return [];
  }

  return origins.split(',').map(origin => origin.trim()).filter(Boolean);
}

/**
 * Get typed and validated environment configuration
 *
 * [ROBUSTNESS] Provides defaults for optional values
 * [SECURITY] Warns about insecure defaults
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';

  const config: EnvironmentConfig = {
    nodeEnv,
    port: parseInt(process.env.PORT || '5000'),
    database: {
      url: process.env.DATABASE_URL || '',
    },
    orbcomm: {
      url: process.env.ORBCOMM_URL || 'wss://wamc.wamcentral.net:44355/cdh',
      username: process.env.ORBCOMM_USERNAME || '',
      password: process.env.ORBCOMM_PASSWORD || '',
      enabled: process.env.ENABLE_ORBCOMM_DEV === 'true' || false,
    },
    whatsapp: {
      phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
      accessToken: process.env.CLOUD_API_ACCESS_TOKEN || '',
      webhookToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || '',
      graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v20.0',
      wabaId: process.env.WABA_ID || '',
    },
    googleAI: {
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
    },
    security: {
      // [SECURITY] JWT configuration with safe defaults
      jwtSecret: process.env.JWT_SECRET || '',
      jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
      jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
      sessionSecret: process.env.SESSION_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      corsOrigins: parseCorsOrigins(),
      bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      enableCsrfProtection: process.env.ENABLE_CSRF_PROTECTION !== 'false',
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      secure: process.env.SMTP_SECURE === 'true',
      from: process.env.EMAIL_FROM || 'noreply@containergenie.com',
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    monitoring: {
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      sentryDsn: process.env.SENTRY_DSN,
      enableDetailedErrors: process.env.ENABLE_DETAILED_ERRORS === 'true',
    },
    features: {
      enableWhatsApp: !!(process.env.CLOUD_API_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID),
      enableOrbcomm: !!(process.env.ORBCOMM_URL && process.env.ORBCOMM_USERNAME && process.env.ORBCOMM_PASSWORD),
      enableExternalInventory: !!process.env.INVENTORY_SOURCE_DATABASE_URL,
    },
  };

  return config;
}

/**
 * Validate environment configuration
 *
 * [SECURITY] Ensures critical values are set in production
 * [ROBUSTNESS] Returns array of error messages
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required in all environments
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (config.nodeEnv === 'production') {
    // [SECURITY] Critical security checks for production
    if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }

    if (!config.security.sessionSecret || config.security.sessionSecret.length < 16) {
      errors.push('SESSION_SECRET must be at least 16 characters in production');
    }

    if (config.security.corsOrigins.length === 0) {
      errors.push('ALLOWED_ORIGINS must be set in production for CORS security');
    }

    if (config.security.bcryptSaltRounds < 12) {
      errors.push('BCRYPT_SALT_ROUNDS must be at least 12 in production');
    }

    if (config.monitoring.enableDetailedErrors) {
      errors.push('ENABLE_DETAILED_ERRORS must be false in production (information disclosure risk)');
    }

    // [SECURITY] Feature-specific validation
    if (config.features.enableWhatsApp) {
      if (!config.whatsapp.phoneNumberId) {
        errors.push('WA_PHONE_NUMBER_ID is required when WhatsApp is enabled');
      }
      if (!config.whatsapp.accessToken) {
        errors.push('CLOUD_API_ACCESS_TOKEN is required when WhatsApp is enabled');
      }
      if (!config.whatsapp.appSecret) {
        errors.push('META_APP_SECRET is required when WhatsApp is enabled');
      }
    }

    // [SECURITY] Warn about insecure SMTP configuration
    if (config.smtp.host && config.smtp.host.includes('gmail.com')) {
      warnings.push('Gmail SMTP is not recommended for production. Use SendGrid, AWS SES, or similar.');
    }

    // [SECURITY] Warn if rate limiting is disabled
    if (!config.security.enableRateLimiting) {
      warnings.push('Rate limiting is disabled. This leaves the API vulnerable to abuse.');
    }

    // [SECURITY] Warn if CSRF protection is disabled
    if (!config.security.enableCsrfProtection) {
      warnings.push('CSRF protection is disabled. This increases CSRF attack risk.');
    }
  }

  // Display warnings (non-blocking)
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  return errors;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Log configuration status at startup
 *
 * [OBSERVABILITY] Helps diagnose configuration issues without exposing secrets
 */
export function logConfigurationStatus(config: EnvironmentConfig): void {
  console.log('✅ Configuration loaded:');
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Port: ${config.port}`);
  console.log(`  - Database: ${config.database.url ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`  - JWT Secret: ${config.security.jwtSecret ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`  - WhatsApp: ${config.features.enableWhatsApp ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - Orbcomm: ${config.features.enableOrbcomm ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - SMTP: ${config.smtp.host ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`  - Rate Limiting: ${config.security.enableRateLimiting ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - CSRF Protection: ${config.security.enableCsrfProtection ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - CORS Origins: ${config.security.corsOrigins.length} configured`);

  if (isProduction()) {
    console.log('🔒 Production mode: Enhanced security enabled');
  } else {
    console.log('🔧 Development mode: Some security features relaxed');
  }
}

/**
 * Initialize and validate configuration at startup
 *
 * [ROBUSTNESS] Exits process if critical config is missing
 */
export function initializeConfiguration(): EnvironmentConfig {
  const config = getEnvironmentConfig();
  const errors = validateEnvironmentConfig(config);

  if (errors.length > 0) {
    console.error('❌ Configuration errors detected:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease fix the configuration errors and restart the application.');
    process.exit(1);
  }

  logConfigurationStatus(config);
  return config;
}
