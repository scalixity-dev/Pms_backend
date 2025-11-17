import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';
import * as jwt from 'jsonwebtoken';

export interface AppleProfile {
  provider: 'APPLE';
  providerUserId: string;
  email: string;
  fullName: string;
}

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID') || '',
      teamID: configService.get<string>('APPLE_TEAM_ID') || '',
      keyID: configService.get<string>('APPLE_KEY_ID') || '',
      privateKeyPath: configService.get<string>('APPLE_PRIVATE_KEY_PATH') || '',
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL') || '/auth/apple/callback',
      scope: ['email', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    // Apple provides user info in the idToken (JWT)
    // Decode the idToken to extract the 'sub' claim as the user identifier
    let sub: string | null = null;

    // Try to get sub from profile first
    if (profile?.id) {
      sub = profile.id;
    } else if (idToken) {
      // Decode the JWT idToken to extract the 'sub' claim
      try {
        // Decode without verification (Apple verifies the token)
        // In production, you may want to verify the token with Apple's public keys
        const decoded = jwt.decode(idToken) as { sub?: string } | null;
        
        if (decoded?.sub) {
          sub = decoded.sub;
        } else {
          throw new Error('Missing sub claim in idToken');
        }
      } catch (error) {
        // If token is invalid or missing sub, return error
        return done(
          new Error(
            `Failed to extract user identifier from Apple idToken: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
          null,
        );
      }
    }

    // If we still don't have a sub, return error
    if (!sub) {
      return done(
        new Error('Unable to extract user identifier from Apple authentication'),
        null,
      );
    }

    // Extract email and name from profile or token
    let email = '';
    let fullName = '';

    // Try to get email from profile first
    if (profile?.email) {
      email = profile.email;
    } else if (idToken) {
      // Try to extract email from decoded token
      try {
        const decoded = jwt.decode(idToken) as { email?: string } | null;
        if (decoded?.email) {
          email = decoded.email;
        }
      } catch (error) {
        // Email extraction failed, will remain empty
      }
    }

    // Try to get name from profile
    if (profile?.name) {
      fullName = `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim();
    }

    // Fallback to email if name is not available
    if (!fullName && email) {
      fullName = email;
    }

    const user: AppleProfile = {
      provider: 'APPLE',
      providerUserId: sub,
      email: profile.email || '',
      fullName: profile.name
        ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
        : profile.email || '',
    };

    done(null, user);
  }
}

