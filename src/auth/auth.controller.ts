import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Param,
  Get,
  Patch,
  UseGuards,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Extend Express Request to include user property from Passport
interface AuthenticatedRequest extends Request {
  user?: {
    provider: 'GOOGLE' | 'FACEBOOK' | 'APPLE';
    providerUserId: string;
    email: string;
    fullName: string;
  };
}
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { AppleStrategy } from './strategies/apple.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Extract IP address from request
   */
  private getIpAddress(req: Request): string {
    // Check for forwarded IP (when behind proxy/load balancer)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }
    // Check for real IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    // Fallback to connection remote address
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Extract user agent from request
   */
  private getUserAgent(req: Request): string | undefined {
    const userAgent = req.headers['user-agent'];
    if (Array.isArray(userAgent)) {
      return userAgent[0];
    }
    return userAgent;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const ipAddress = this.getIpAddress(req);
    const userAgent = this.getUserAgent(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    return this.authService.register(registerDto, ipAddress, userAgent, deviceFingerprint);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ipAddress = this.getIpAddress(req);
    const userAgent = this.getUserAgent(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    const result = await this.authService.login(loginDto, ipAddress, userAgent, deviceFingerprint);

    // Only set JWT cookie if token exists (i.e., device is verified)
    if (result.token) {
      res.cookie('access_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/', // Ensure cookie is available for all paths
      });
    }

    return res.json({
      user: result.user,
      message: result.message || 'Login successful',
      requiresDeviceVerification: result.requiresDeviceVerification || false,
    });
  }

  @Post('resend-email-otp/:userId')
  @HttpCode(HttpStatus.OK)
  async resendEmailOtp(@Param('userId') userId: string) {
    await this.authService.resendEmailOtp(userId);
    return {
      message: 'OTP email sent successfully',
    };
  }

  @Post('verify-email/:userId')
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(
    @Param('userId') userId: string,
    @Body() verifyOtpDto: VerifyOtpDto,
  ) {
    await this.authService.verifyEmailOtp(userId, verifyOtpDto.code);
    return {
      message: 'Email verified successfully',
    };
  }

  @Post('verify-device/:userId')
  @HttpCode(HttpStatus.OK)
  async verifyDeviceOtp(
    @Param('userId') userId: string,
    @Body() verifyOtpDto: VerifyOtpDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ipAddress = this.getIpAddress(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;
    const result = await this.authService.verifyDeviceOtp(userId, verifyOtpDto.code, ipAddress, deviceFingerprint);
    
    // Set JWT as HTTP-only cookie
    res.cookie('access_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      message: 'Device verified successfully',
    });
  }

  @Post('activate-account/:userId')
  @HttpCode(HttpStatus.OK)
  async activateAccount(
    @Param('userId') userId: string,
    @Body() activateAccountDto: ActivateAccountDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.activateAccount(userId, activateAccountDto);
    
    // Set JWT as HTTP-only cookie
    if (result.token) {
      res.cookie('access_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
    
    return res.json({
      success: result.success,
      message: result.message,
    });
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Body() body: { email: string }) {
    const exists = await this.authService.checkEmailExists(body.email);
    return {
      exists,
    };
  }

  @Get('me')
  @SkipThrottle() // Skip rate limiting for this frequently-called endpoint
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: Request & { user?: { userId: string } }) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Fetch full user data from database
    const user = await this.authService.getUserById(userId);
    return {
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        country: user.country,
        address: user.address,
        phoneNumber: user.phoneNumber,
        phoneCountryCode: user.phoneCountryCode,
        state: user.state,
        pincode: user.pincode,
      },
    };
  }

  @Patch('profile')
  @SkipThrottle() // Skip rate limiting for authenticated profile updates
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: Request & { user?: { userId: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const updatedUser = await this.authService.updateProfile(userId, updateProfileDto);
    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res() res: Response) {
    // Clear the JWT cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return res.json({
      message: 'Logged out successfully',
    });
  }

  @Post('check-device/:userId')
  @HttpCode(HttpStatus.OK)
  async checkDevice(@Param('userId') userId: string, @Req() req: Request) {
    const ipAddress = this.getIpAddress(req);
    const userAgent = this.getUserAgent(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    return this.authService.checkDeviceAndSendOtp(userId, ipAddress, userAgent, deviceFingerprint);
  }

  // Google OAuth
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const user = req.user;
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?success=false&error=authentication_failed`);
    }
    const ipAddress = this.getIpAddress(req);
    const userAgent = this.getUserAgent(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    const result = await this.authService.handleOAuthCallback(
      'GOOGLE',
      user.providerUserId,
      user.email,
      user.fullName,
      ipAddress,
      userAgent,
      deviceFingerprint,
    );

    // Set JWT as HTTP-only cookie
    res.cookie('access_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?success=true&userId=${result.user.id}`);
  }

  // Facebook OAuth
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {
    // Initiates Facebook OAuth flow
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const user = req.user;
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?success=false&error=authentication_failed`);
    }
    const ipAddress = this.getIpAddress(req);
    const userAgent = this.getUserAgent(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    const result = await this.authService.handleOAuthCallback(
      'FACEBOOK',
      user.providerUserId,
      user.email,
      user.fullName,
      ipAddress,
      userAgent,
      deviceFingerprint,
    );

    // Set JWT as HTTP-only cookie
    res.cookie('access_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?success=true&userId=${result.user.id}`);
  }

  // Apple OAuth
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {
    // Initiates Apple OAuth flow
  }

  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleAuthCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const user = req.user;
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?success=false&error=authentication_failed`);
    }
    const ipAddress = this.getIpAddress(req);
    const userAgent = this.getUserAgent(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    const result = await this.authService.handleOAuthCallback(
      'APPLE',
      user.providerUserId,
      user.email,
      user.fullName,
      ipAddress,
      userAgent,
      deviceFingerprint,
    );

    // Set JWT as HTTP-only cookie
    res.cookie('access_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?success=true&userId=${result.user.id}`);
  }
}
