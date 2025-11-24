import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  provider: 'GOOGLE';
  providerUserId: string;
  email: string;
  fullName: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback';
    
    // Log for debugging (remove in production)
    console.log('🔍 Google OAuth Configuration:');
    console.log('  Client ID:', configService.get<string>('GOOGLE_CLIENT_ID') ? '✅ Set' : '❌ Missing');
    console.log('  Client Secret:', configService.get<string>('GOOGLE_CLIENT_SECRET') ? '✅ Set' : '❌ Missing');
    console.log('  Callback URL:', callbackURL);
    
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, name, emails } = profile;

    // Extract email with null/optional guards
    const email = emails?.[0]?.value || '';

    // Compute fullName defensively
    let fullName = '';
    if (name) {
      const givenName = name.givenName || '';
      const familyName = name.familyName || '';
      fullName = `${givenName} ${familyName}`.trim();
    }

    // Fall back to email if fullName is empty
    if (!fullName && email) {
      fullName = email;
    }

    const user: GoogleProfile = {
      provider: 'GOOGLE',
      providerUserId: id,
      email,
      fullName,
    };

    done(null, user);
  }
}

