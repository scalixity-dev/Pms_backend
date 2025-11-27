import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

/**
 * Security Configuration
 * 
 * This file contains all security-related configurations including:
 * - Rate limiting settings
 * - Security headers
 * - CORS configuration
 * - Request size limits
 * - Timeout settings
 */

export interface SecurityConfig {
  rateLimit: ThrottlerModuleOptions;
  cors: {
    origin: (string | undefined)[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  helmet: {
    enabled: boolean;
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: boolean;
    crossOriginResourcePolicy: boolean;
    dnsPrefetchControl: boolean;
    frameguard: boolean;
    hidePoweredBy: boolean;
    hsts: boolean;
    ieNoOpen: boolean;
    noSniff: boolean;
    originAgentCluster: boolean;
    permittedCrossDomainPolicies: boolean;
    referrerPolicy: boolean;
    xssFilter: boolean;
  };
  request: {
    maxSize: string;
    timeout: number;
    keepAliveTimeout: number;
  };
  api: {
    prefix: string;
    version: string;
  };
}

/**
 * Get rate limiting configuration
 * Different limits for different environments
 */
export function getRateLimitConfig(configService: ConfigService): ThrottlerModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // Production: stricter limits
  // Development: more lenient for testing
  const defaultTtl = isProduction ? 60000 : 60000; // 1 minute window
  const defaultLimit = isProduction ? 100 : 1000; // requests per window

  return {
    throttlers: [
      {
        name: 'default',
        ttl: configService.get<number>('RATE_LIMIT_TTL', defaultTtl),
        limit: configService.get<number>('RATE_LIMIT_MAX', defaultLimit),
      },
      // Stricter limits for authentication endpoints
      {
        name: 'auth',
        ttl: configService.get<number>('RATE_LIMIT_AUTH_TTL', 60000), // 1 minute
        limit: configService.get<number>('RATE_LIMIT_AUTH_MAX', isProduction ? 5 : 20), // 5 requests per minute in prod
      },
      // Stricter limits for file upload endpoints
      {
        name: 'upload',
        ttl: configService.get<number>('RATE_LIMIT_UPLOAD_TTL', 60000), // 1 minute
        limit: configService.get<number>('RATE_LIMIT_UPLOAD_MAX', isProduction ? 10 : 50), // 10 uploads per minute in prod
      },
    ],
  };
}

/**
 * Get CORS configuration
 */
export function getCorsConfig(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  const allowedOrigins = isProduction
    ? [
        'https://pms.scalixity.com',
        configService.get<string>('FRONTEND_URL'),
      ].filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5174',
        configService.get<string>('FRONTEND_URL') || 'http://localhost:5173',
      ].filter(Boolean);

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Device-Fingerprint',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  };
}

/**
 * Get Helmet security headers configuration
 */
export function getHelmetConfig(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  return {
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        }
      : false, // Disable in development for easier debugging
    crossOriginEmbedderPolicy: isProduction,
    crossOriginOpenerPolicy: { policy: 'same-origin' as const },
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' as const },
    hidePoweredBy: true,
    hsts: isProduction
      ? {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        }
      : false, // Disable in development
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'no-referrer' as const },
    xssFilter: true,
  };
}

/**
 * Get request size and timeout configuration
 */
export function getRequestConfig(configService: ConfigService) {
  return {
    maxSize: configService.get<string>('MAX_REQUEST_SIZE', '10mb'),
    timeout: configService.get<number>('REQUEST_TIMEOUT', 30000), // 30 seconds
    keepAliveTimeout: configService.get<number>('KEEP_ALIVE_TIMEOUT', 65000), // 65 seconds
  };
}

/**
 * Get API configuration
 */
export function getApiConfig(configService: ConfigService) {
  return {
    prefix: configService.get<string>('API_PREFIX', 'api'),
    version: configService.get<string>('API_VERSION', 'v1'),
  };
}

/**
 * Complete security configuration
 */
export function getSecurityConfig(configService: ConfigService): SecurityConfig {
  return {
    rateLimit: getRateLimitConfig(configService),
    cors: getCorsConfig(configService),
    helmet: getHelmetConfig(configService) as any,
    request: getRequestConfig(configService),
    api: getApiConfig(configService),
  };
}

