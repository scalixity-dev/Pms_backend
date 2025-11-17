import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

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
  
  // Enable validation pipe for class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
