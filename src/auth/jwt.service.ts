import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtService {
  private readonly secret: string;
  private readonly expiresIn: string;
  private readonly MIN_SECRET_LENGTH = 32;

  constructor(private readonly configService: ConfigService) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // Validate JWT_SECRET
    if (!jwtSecret) {
      if (nodeEnv === 'development') {
        throw new Error(
          'JWT_SECRET is required. Please set JWT_SECRET in your .env file. ' +
          'For development, you can use a temporary secret, but it must be at least 32 characters long. ' +
          'Example: JWT_SECRET=your-development-secret-key-at-least-32-chars-long',
        );
      } else {
        throw new Error(
          'JWT_SECRET is required and must be set in your environment variables. ' +
          'This is a critical security requirement. Please set JWT_SECRET to a strong, random string ' +
          'of at least 32 characters in your production environment configuration.',
        );
      }
    }

    // Validate minimum secret length
    if (jwtSecret.length < this.MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${this.MIN_SECRET_LENGTH} characters long for security. ` +
        `Current length: ${jwtSecret.length}. Please use a longer, cryptographically secure secret.`,
      );
    }

    this.secret = jwtSecret;
    this.expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';
  }

  /**
   * Generate JWT token
   */
  sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    });
  }

  /**
   * Verify JWT token
   */
  verify(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }
}

