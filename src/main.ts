import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

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
  
  // Enable cookie parser
  app.use(cookieParser());
  
  // Configure CORS based on environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  
  // Set allowed origins based on environment
  const allowedOrigins = isProduction
    ? [
        'https://pms.scalixity.com', // Production frontend
        process.env.FRONTEND_URL, // Allow override via env if needed
      ].filter(Boolean) // Remove undefined values
    : [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000', // Alternative frontend port
        process.env.FRONTEND_URL || 'http://localhost:5173', // Allow override via env
      ].filter(Boolean); // Remove undefined values
  
  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Fingerprint'],
  });
  
  // Enable validation pipe for class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  // Set port based on environment: 5742 for production, 3000 for development
  const port = process.env.PORT || (isProduction ? 5742 : 3000);
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📦 Environment: ${nodeEnv}`);
  if (isProduction) {
    console.log(`🌐 Frontend URL: https://pms.scalixity.com`);
  }
}
bootstrap();
