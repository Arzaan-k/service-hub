export interface ProductionConfig {
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
  email: {
    service: 'sendgrid' | 'ses' | 'smtp';
    apiKey?: string;
    from: string;
  };
  storage: {
    service: 's3' | 'cloudinary' | 'local';
    aws?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucket: string;
    };
  };
  payment: {
    gateway: 'stripe' | 'razorpay';
    stripe?: {
      secretKey: string;
      publishableKey: string;
    };
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
    corsOrigin: string;
  };
  monitoring: {
    sentryDsn?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export function getProductionConfig(): ProductionConfig {
  return {
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
    email: {
      service: (process.env.EMAIL_SERVICE as 'sendgrid' | 'ses' | 'smtp') || 'smtp',
      apiKey: process.env.EMAIL_API_KEY,
      from: process.env.EMAIL_FROM || 'noreply@container-genie.com',
    },
    storage: {
      service: (process.env.STORAGE_SERVICE as 's3' | 'cloudinary' | 'local') || 'local',
      aws: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || 'container-genie-storage',
      } : undefined,
    },
    payment: {
      gateway: (process.env.PAYMENT_GATEWAY as 'stripe' | 'razorpay') || 'stripe',
      stripe: process.env.STRIPE_SECRET_KEY ? {
        secretKey: process.env.STRIPE_SECRET_KEY,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      } : undefined,
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
    monitoring: {
      sentryDsn: process.env.SENTRY_DSN,
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    },
  };
}

export function validateProductionConfig(config: ProductionConfig): string[] {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.whatsapp.phoneNumberId) {
    errors.push('WA_PHONE_NUMBER_ID is required for WhatsApp integration');
  }

  if (!config.whatsapp.accessToken) {
    errors.push('CLOUD_API_ACCESS_TOKEN is required for WhatsApp integration');
  }

  if (!config.whatsapp.webhookToken) {
    errors.push('WEBHOOK_VERIFICATION_TOKEN is required for WhatsApp webhooks');
  }

  if (!config.googleAI.apiKey) {
    errors.push('GOOGLE_AI_API_KEY is required for AI features');
  }

  if (config.email.service !== 'smtp' && !config.email.apiKey) {
    errors.push(`${config.email.service.toUpperCase()}_API_KEY is required for email service`);
  }

  if (config.storage.service === 's3' && !config.storage.aws) {
    errors.push('AWS credentials are required for S3 storage');
  }

  if (config.payment.gateway === 'stripe' && !config.payment.stripe) {
    errors.push('Stripe credentials are required for payment processing');
  }

  return errors;
}
