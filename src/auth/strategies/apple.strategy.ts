import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';

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
    // You may need to decode it to get email and name
    // For now, we'll use the profile data
    const sub = profile.id || idToken; // Apple uses 'sub' as user identifier

    const user: AppleProfile = {
      provider: 'APPLE',
      providerUserId: sub,
      email: profile.email || profile.email || '',
      fullName: profile.name
        ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
        : profile.email || '',
    };

    done(null, user);
  }
}

