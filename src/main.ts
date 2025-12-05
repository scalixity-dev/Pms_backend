import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { getCorsConfig, getHelmetConfig, getRequestConfig, getCompressionConfig } from './config/security.config';
import { CompressionLoggerMiddleware } from './middleware/compression-logger.middleware';

/**
 * Validate critical environment variables before application startup
 * This ensures the application fails fast with clear error messages if JWT_SECRET is missing or insecure
 */
function validateEnvironmentVariables(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET;
  const MIN_SECRET_LENGTH = 32;

  // Validate JWT_SECRET
  if (!jwtSecret) {
    if (nodeEnv === 'development') {
      console.error(
        '\n❌ ERROR: JWT_SECRET is required.\n' +
        '   Please set JWT_SECRET in your .env file.\n' +
        '   For development, you can use a temporary secret, but it must be at least 32 characters long.\n' +
        '   Example: JWT_SECRET=your-development-secret-key-at-least-32-chars-long\n',
      );
      process.exit(1);
    } else {
      console.error(
        '\n❌ CRITICAL ERROR: JWT_SECRET is required in non-development environments.\n' +
        '   This is a critical security requirement. Please set JWT_SECRET to a strong, random string\n' +
        '   of at least 32 characters in your production environment configuration.\n' +
        '   Application startup aborted for security reasons.\n',
      );
      process.exit(1);
    }
  }

  // Validate minimum secret length
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    console.error(
      `\n❌ CRITICAL ERROR: JWT_SECRET is too short (${jwtSecret.length} characters).\n` +
      `   JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long for security.\n` +
      '   Please use a longer, cryptographically secure secret.\n' +
      '   Application startup aborted for security reasons.\n',
    );
    process.exit(1);
  }

  console.log('✅ Environment variables validated successfully');
}

async function bootstrap() {
  // Validate environment variables before creating the app
  // This ensures we fail fast with clear error messages
  validateEnvironmentVariables();

  // Now create the actual application
  const app = await NestFactory.create(AppModule);
  
  // Get ConfigService for security configuration
  const configService = app.get(ConfigService);
  
  // Enable cookie parser
  app.use(cookieParser());
  
  // Configure security headers using Helmet
  const helmetConfig = getHelmetConfig(configService);
  app.use(helmet(helmetConfig));
  
  // Configure CORS using security config
  const corsConfig = getCorsConfig(configService);
  app.enableCors(corsConfig);
  
  const compressionConfig = getCompressionConfig(configService);
  const compressionLoggingEnabled = configService.get<boolean>('COMPRESSION_LOGGING_ENABLED', true);
  
  if (compressionConfig.enabled) {
    app.use(compression({
      level: compressionConfig.level,
      threshold: compressionConfig.threshold,
      filter: compressionConfig.filter,
      chunkSize: compressionConfig.chunkSize,
    }));

    if (compressionLoggingEnabled) {
      app.use((req: any, res: any, next: any) => {
        const logger = new CompressionLoggerMiddleware();
        logger.use(req, res, next);
      });
    }
    
    console.log(`Response compression enabled (level: ${compressionConfig.level}, threshold: ${compressionConfig.threshold} bytes)`);
    if (compressionLoggingEnabled) {
      console.log(`Compression logging enabled - will log compression stats for each request`);
    }
  }
  
  // Configure request size limits and timeouts
  const requestConfig = getRequestConfig(configService);
  // Note: Request size limits are typically handled by the reverse proxy (nginx, etc.)
  // Timeout configuration would be set at the server level
  
  // Enable validation pipe for class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Additional security: limit payload size
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // Set port based on environment: 5742 for production, 3000 for development
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const port = configService.get<number>('PORT', isProduction ? 5742 : 3000);
  
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📦 Environment: ${nodeEnv}`);
  console.log(`🔒 Security features enabled: Rate Limiting, Helmet, CORS`);
  console.log(`Performance features enabled: Response Compression`);
  if (isProduction) {
    console.log(`🌐 Frontend URL: https://pms.scalixity.com`);
  }
}
bootstrap();
