# OAuth Setup Guide

## Installation Commands

Run these commands to install all required packages:

```bash
pnpm add @nestjs/passport passport passport-google-oauth20 passport-facebook passport-apple jsonwebtoken
pnpm add -D @types/passport-google-oauth20 @types/passport-facebook @types/passport-apple @types/jsonwebtoken
```

## Environment Variables

Add these to your `.env` file:

### JWT Configuration
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

### Google OAuth
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### Facebook OAuth
```env
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:3000/auth/facebook/callback
```

### Apple OAuth
```env
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY_PATH=path/to/your/AuthKey_XXXXXXXXXX.p8
APPLE_CALLBACK_URL=http://localhost:3000/auth/apple/callback
```

## OAuth Provider Setup

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URIs: `http://localhost:3000/auth/google/callback` (and production URL)
6. Copy Client ID and Client Secret to `.env`

### Facebook OAuth Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add "Facebook Login" product
4. Go to Settings → Basic
5. Add authorized redirect URIs: `http://localhost:3000/auth/facebook/callback`
6. Copy App ID and App Secret to `.env`

### Apple OAuth Setup
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a Service ID
3. Configure Sign in with Apple
4. Download the private key (.p8 file)
5. Note the Key ID and Team ID
6. Set the private key path in `.env`

## API Endpoints

### Google OAuth
- **Initiate**: `GET /auth/google`
- **Callback**: `GET /auth/google/callback`

### Facebook OAuth
- **Initiate**: `GET /auth/facebook`
- **Callback**: `GET /auth/facebook/callback`

### Apple OAuth
- **Initiate**: `GET /auth/apple`
- **Callback**: `GET /auth/apple/callback`

## How It Works

1. User clicks "Sign in with Google/Facebook/Apple"
2. Frontend redirects to `/auth/{provider}`
3. Passport redirects to OAuth provider
4. User authenticates with provider
5. Provider redirects to `/auth/{provider}/callback`
6. Strategy validates and extracts user info
7. AuthService finds or creates user in database
8. JWT token is generated and set as HTTP-only cookie
9. User is redirected to frontend with success status

## Notes

- JWT tokens are set as HTTP-only cookies for security
- OAuth users are automatically marked as email verified
- Device tracking is implemented for all OAuth logins
- Users can link multiple OAuth providers to the same account

