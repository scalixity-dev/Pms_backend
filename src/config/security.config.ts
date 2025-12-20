import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { HelmetOptions } from 'helmet';

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
  helmet: HelmetOptions;
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
  
  // Check if rate limiting is disabled via environment variable
  const rateLimitEnabled = configService.get<string>('RATE_LIMIT_ENABLED', 'true').toLowerCase() === 'true';

  // Production: stricter limits
  // Development: very lenient for testing and development
  const defaultTtl = isProduction ? 60000 : 60000; // 1 minute window
  const defaultLimit = isProduction ? 100 : 10000; // requests per window (increased from 1000 to 10000 for dev)

  // If rate limiting is disabled, set very high limits (effectively disabled)
  const effectiveLimit = rateLimitEnabled 
    ? configService.get<number>('RATE_LIMIT_MAX', defaultLimit)
    : 999999; // Effectively unlimited

  const effectiveAuthLimit = rateLimitEnabled
    ? configService.get<number>('RATE_LIMIT_AUTH_MAX', isProduction ? 5 : 100)
    : 999999;

  const effectiveUploadLimit = rateLimitEnabled
    ? configService.get<number>('RATE_LIMIT_UPLOAD_MAX', isProduction ? 10 : 200)
    : 999999;

  return {
    throttlers: [
      {
        name: 'default',
        ttl: configService.get<number>('RATE_LIMIT_TTL', defaultTtl),
        limit: effectiveLimit,
      },
      // Stricter limits for authentication endpoints
      {
        name: 'auth',
        ttl: configService.get<number>('RATE_LIMIT_AUTH_TTL', 60000), // 1 minute
        limit: effectiveAuthLimit,
      },
      // Stricter limits for file upload endpoints
      {
        name: 'upload',
        ttl: configService.get<number>('RATE_LIMIT_UPLOAD_TTL', 60000), // 1 minute
        limit: effectiveUploadLimit,
      },
    ],
    // Use in-memory storage (default) - resets on server restart
    // For production, consider using Redis storage for distributed systems
    storage: undefined, // undefined = in-memory storage
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
export function getHelmetConfig(configService: ConfigService): HelmetOptions {
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
 * Get compression configuration
 * Optimized for production with Brotli support and smart filtering
 */
export function getCompressionConfig(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  return {
    enabled: configService.get<boolean>('COMPRESSION_ENABLED', true),
    level: configService.get<number>('COMPRESSION_LEVEL', isProduction ? 4 : 1),
    threshold: configService.get<number>('COMPRESSION_THRESHOLD', 1024),
    filter: (req: any, res: any) => {
      if (req.headers['x-no-compression']) {
        return false;
      }

      const contentType = res.getHeader('content-type') || '';
      const path = req.path || '';
      
      const compressibleTypes = [
        'application/json',
        'application/javascript',
        'application/xml',
        'text/html',
        'text/css',
        'text/javascript',
        'text/plain',
        'text/xml',
        'application/vnd.api+json',
      ];

      const contentTypeMatches = compressibleTypes.some(type => contentType.includes(type));
      const isApiRoute = path.startsWith('/api') || path.startsWith('/property') || path.startsWith('/auth') || path.startsWith('/listing');
      
      return contentTypeMatches || isApiRoute;
    },
    chunkSize: configService.get<number>('COMPRESSION_CHUNK_SIZE', 16 * 1024),
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
    helmet: getHelmetConfig(configService),
    request: getRequestConfig(configService),
    api: getApiConfig(configService),
  };
}

