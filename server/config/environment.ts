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
  };
  whatsapp: {
    phoneNumberId: string;
    accessToken: string;
    webhookToken: string;
  };
  googleAI: {
    apiKey: string;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
    corsOrigin: string;
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  
  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '5000'),
    database: {
      url: process.env.DATABASE_URL || '',
    },
    orbcomm: {
      url: process.env.ORBCOMM_URL || 'wss://integ.tms-orbcomm.com:44355/cdh',
      username: process.env.ORBCOMM_USERNAME || 'cdhQuadre',
      password: process.env.ORBCOMM_PASSWORD || 'P4cD#QA@!D@re',
    },
    whatsapp: {
      phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
      accessToken: process.env.CLOUD_API_ACCESS_TOKEN || '',
      webhookToken: process.env.WEBHOOK_VERIFICATION_TOKEN || '',
    },
    googleAI: {
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key-change-in-production',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
    monitoring: {
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    },
  };
}

export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (config.nodeEnv === 'production') {
    if (!config.whatsapp.phoneNumberId) {
      errors.push('WA_PHONE_NUMBER_ID is required for production');
    }

    if (!config.whatsapp.accessToken) {
      errors.push('CLOUD_API_ACCESS_TOKEN is required for production');
    }

    if (!config.whatsapp.webhookToken) {
      errors.push('WEBHOOK_VERIFICATION_TOKEN is required for production');
    }

    if (!config.googleAI.apiKey) {
      errors.push('GOOGLE_AI_API_KEY is required for production');
    }

    if (config.security.jwtSecret === 'your-jwt-secret-key-change-in-production') {
      errors.push('JWT_SECRET must be changed from default value in production');
    }

    if (config.security.encryptionKey === 'your-encryption-key-change-in-production') {
      errors.push('ENCRYPTION_KEY must be changed from default value in production');
    }
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
