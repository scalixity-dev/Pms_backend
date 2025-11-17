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

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be defined in environment variables');
    }
    this.secret = secret;
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

