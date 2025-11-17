import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Param,
  Get,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

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
import { VerifyOtpDto } from './dto/verify-otp.dto';
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
  ) {
    const ipAddress = this.getIpAddress(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;
    await this.authService.verifyDeviceOtp(userId, verifyOtpDto.code, ipAddress, deviceFingerprint);
    return {
      message: 'Device verified successfully',
    };
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
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?success=false&error=authentication_failed`);
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?success=false&error=authentication_failed`);
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?success=false&error=authentication_failed`);
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?success=true&userId=${result.user.id}`);
  }
}
