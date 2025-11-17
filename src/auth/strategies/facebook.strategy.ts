import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';

export interface FacebookProfile {
  provider: 'FACEBOOK';
  providerUserId: string;
  email: string;
  fullName: string;
}

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID') || '',
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET') || '',
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL') || '/auth/facebook/callback',
      scope: ['email'],
      profileFields: ['id', 'email', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void,
  ): Promise<void> {
    const { id, name, emails } = profile;

    const user: FacebookProfile = {
      provider: 'FACEBOOK',
      providerUserId: id,
      email: emails?.[0]?.value || '',
      fullName: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : emails?.[0]?.value || '',
    };

    done(null, user);
  }
}

