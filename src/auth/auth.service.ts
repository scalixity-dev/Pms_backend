import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from './jwt.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as argon2 from 'argon2';
import { AuthProvider, UserRole, OtpType, SubscriptionStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import { addYears, addMonths } from 'date-fns';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly OTP_LENGTH = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generate a secure random OTP code using crypto.randomInt
   */
  private generateOtp(): string {
    // Generate random integer between 0 and 10^OTP_LENGTH - 1
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const otp = randomInt(min, max + 1);
    // Zero-pad to ensure consistent length
    return otp.toString().padStart(this.OTP_LENGTH, '0');
  }

  /**
   * Check if property manager has an active subscription
   * Returns true only if an active/valid subscription exists for the email
   */
  private async checkPropertyManagerSubscription(email: string): Promise<boolean> {
    // Handle null/undefined email
    if (!email) {
      return false;
    }

    try {
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          subscriptions: {
            where: {
              status: {
                in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      // If user doesn't exist, no subscription
      if (!user) {
        return false;
      }

      // If no subscriptions found, return false
      if (!user.subscriptions || user.subscriptions.length === 0) {
        return false;
      }

      const subscription = user.subscriptions[0];
      const now = new Date();

      // Check if subscription has an end date and if it's still valid
      if (subscription.endDate && subscription.endDate < now) {
        return false;
      }

      // Check if subscription was cancelled
      if (subscription.cancelledAt && subscription.cancelledAt <= now) {
        return false;
      }

      // Check if subscription start date is in the future (shouldn't happen, but validate)
      if (subscription.startDate > now) {
        return false;
      }

      // Subscription is valid
      return true;
    } catch (error) {
      // Log error and return false to fail securely
      console.error('Error checking property manager subscription:', error);
      return false;
    }
  }

  /**
   * Track device and IP address for a user
   */
  private async trackDevice(
    userId: string,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ): Promise<{ isNewDevice: boolean; deviceId: string }> {
    // Check if device already exists
    const existingDevice = await this.prisma.device.findFirst({
      where: {
        userId,
        ipAddress,
        deviceFingerprint: deviceFingerprint || null,
      },
    });

    if (existingDevice) {
      // Update last seen
      await this.prisma.device.update({
        where: { id: existingDevice.id },
        data: { lastSeenAt: new Date() },
      });
      return { isNewDevice: !existingDevice.isVerified, deviceId: existingDevice.id };
    }

    // Create new device
    const newDevice = await this.prisma.device.create({
      data: {
        userId,
        ipAddress,
        userAgent,
        deviceFingerprint,
        isVerified: false,
      },
    });

    return { isNewDevice: true, deviceId: newDevice.id };
  }

  /**
   * Create and send OTP
   */
  private async createAndSendOtp(
    userId: string,
    email: string,
    fullName: string,
    type: OtpType,
    ipAddress?: string,
  ): Promise<string> {
    const otpCode = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Invalidate any existing unused OTPs of the same type
    await this.prisma.otp.updateMany({
      where: {
        userId,
        type,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Create new OTP
    await this.prisma.otp.create({
      data: {
        userId,
        code: otpCode,
        type,
        expiresAt,
        isUsed: false,
      },
    });

    // Send OTP via email
    if (type === OtpType.EMAIL_VERIFICATION) {
      await this.emailService.sendOtpEmail(email, otpCode, fullName);
    } else if (type === OtpType.DEVICE_VERIFICATION && ipAddress) {
      await this.emailService.sendDeviceVerificationEmail(email, otpCode, fullName, ipAddress);
    }

    return otpCode;
  }

  async register(
    registerDto: RegisterDto,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ) {
    const {
      email,
      password,
      fullName,
      phoneCountryCode,
      phoneNumber,
      country,
      state,
      pincode,
      address,
    } = registerDto;

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // For property managers, check subscription before registration
    // Note: Adjust this based on your subscription system
    // You might check a pre-registration subscription table or require subscription first
    const role = UserRole.PROPERTY_MANAGER; // Default role
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Only check subscription in production, allow registration in development
    if (role === UserRole.PROPERTY_MANAGER && nodeEnv === 'production') {
      const hasSubscription = await this.checkPropertyManagerSubscription(email);
      if (!hasSubscription) {
        throw new BadRequestException(
          'Property managers must have an active subscription before registration',
        );
      }
    }

    // Hash the password
    const passwordHash = await argon2.hash(password);

    // Create user, auth identity, device, and OTP in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          email,
          fullName,
          role,
          phoneCountryCode: phoneCountryCode || null,
          phoneNumber: phoneNumber || null,
          country: country || null,
          state: state || null,
          pincode: pincode || null,
          address: address || null,
        },
      });

      // Create the auth identity
      await tx.userAuthIdentity.create({
        data: {
          userId: newUser.id,
          provider: AuthProvider.EMAIL_PASSWORD,
          passwordHash,
        },
      });

      // Track device
      await tx.device.create({
        data: {
          userId: newUser.id,
          ipAddress,
          userAgent,
          deviceFingerprint,
          isVerified: false,
        },
      });

      // Create email verification OTP using shared method
      const otpCode = this.generateOtp();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      await tx.otp.create({
        data: {
          userId: newUser.id,
          code: otpCode,
          type: OtpType.EMAIL_VERIFICATION,
          expiresAt,
          isUsed: false,
        },
      });

      return { newUser, otpCode };
    });

    // Send OTP email (outside transaction to avoid rollback on email failure)
    try {
      await this.emailService.sendOtpEmail(email, user.otpCode, fullName);
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send OTP email:', error);
    }

    // Extract user from the result
    const createdUser = user.newUser;

    // Return user data without sensitive information
    return {
      id: createdUser.id,
      email: createdUser.email,
      fullName: createdUser.fullName,
      role: createdUser.role,
      isEmailVerified: createdUser.isEmailVerified,
      isActive: createdUser.isActive,
      createdAt: createdUser.createdAt,
      message: 'Registration successful. Please check your email for OTP verification.',
    };
  }

  /**
   * Resend email verification OTP
   */
  async resendEmailOtp(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create and send new OTP
    await this.createAndSendOtp(
      userId,
      user.email,
      user.fullName,
      OtpType.EMAIL_VERIFICATION,
    );
  }

  /**
   * Verify email OTP
   */
  async verifyEmailOtp(userId: string, code: string): Promise<void> {
    // Validate code format
    if (!code || typeof code !== 'string' || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new BadRequestException('OTP code must be exactly 6 digits');
    }

    const now = new Date();

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find matching OTP
    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: userId,
        code: code.trim(),
        type: OtpType.EMAIL_VERIFICATION,
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent OTP
      },
    });

    if (!otp) {
      // Check if OTP exists but is expired
      const expiredOtp = await this.prisma.otp.findFirst({
        where: {
          userId: userId,
          code: code.trim(),
          type: OtpType.EMAIL_VERIFICATION,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (expiredOtp) {
        if (expiredOtp.isUsed) {
          throw new BadRequestException('This OTP code has already been used. Please request a new code.');
        } else if (expiredOtp.expiresAt <= now) {
          throw new BadRequestException('This OTP code has expired. Please request a new code.');
        }
      }

      throw new BadRequestException('Invalid OTP code. Please check the code and try again, or request a new code.');
    }

    // Mark OTP as used and verify user email
    await this.prisma.$transaction(async (tx) => {
      await tx.otp.update({
        where: { id: otp.id },
        data: { isUsed: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: { isEmailVerified: true },
      });
    });
  }

  /**
   * Verify device OTP
   */
  async verifyDeviceOtp(
    userId: string,
    code: string,
    ipAddress: string,
    deviceFingerprint?: string,
  ): Promise<{ token: string }> {
    // Validate code format
    if (!code || typeof code !== 'string' || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new BadRequestException('OTP code must be exactly 6 digits');
    }

    const now = new Date();

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find matching OTP
    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: userId,
        code: code.trim(),
        type: OtpType.DEVICE_VERIFICATION,
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent OTP
      },
    });

    if (!otp) {
      // Check if OTP exists but is expired or used
      const expiredOtp = await this.prisma.otp.findFirst({
        where: {
          userId: userId,
          code: code.trim(),
          type: OtpType.DEVICE_VERIFICATION,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (expiredOtp) {
        if (expiredOtp.isUsed) {
          throw new BadRequestException('This OTP code has already been used. Please request a new code.');
        } else if (expiredOtp.expiresAt <= now) {
          throw new BadRequestException('This OTP code has expired. Please request a new code.');
        }
      }

      throw new BadRequestException('Invalid OTP code. Please check the code and try again, or request a new code.');
    }

    // Mark OTP as used and verify device, then generate JWT token
    const token = await this.prisma.$transaction(async (tx) => {
      await tx.otp.update({
        where: { id: otp.id },
        data: { isUsed: true },
      });

      // Update device matching both IP and fingerprint (consistent with trackDevice)
      await tx.device.updateMany({
        where: {
          userId: userId,
          ipAddress,
          deviceFingerprint: deviceFingerprint || null,
        },
        data: { isVerified: true },
      });

      // Generate JWT token after successful device verification
      return this.jwtService.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    });

    return { token };
  }

  /**
   * Check device and send OTP if new device
   */
  async checkDeviceAndSendOtp(
    userId: string,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ): Promise<{ requiresVerification: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { isNewDevice } = await this.trackDevice(
      userId,
      ipAddress,
      userAgent,
      deviceFingerprint,
    );

    if (isNewDevice) {
      await this.createAndSendOtp(
        userId,
        user.email,
        user.fullName,
        OtpType.DEVICE_VERIFICATION,
        ipAddress,
      );
      return {
        requiresVerification: true,
        message: 'New device detected. OTP sent to your email for verification.',
      };
    }

    return {
      requiresVerification: false,
      message: 'Device verified',
    };
  }

  /**
   * Handle OAuth callback - find or create user, create auth identity, track device, and generate JWT
   */
  async handleOAuthCallback(
    provider: 'GOOGLE' | 'FACEBOOK' | 'APPLE',
    providerUserId: string,
    email: string,
    fullName: string,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ) {
    const authProvider = provider === 'GOOGLE' 
      ? AuthProvider.GOOGLE 
      : provider === 'FACEBOOK' 
      ? AuthProvider.FACEBOOK 
      : AuthProvider.APPLE;

    // Find existing user by email or providerUserId
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          {
            authIdentities: {
              some: {
                provider: authProvider,
                providerUserId,
              },
            },
          },
        ],
      },
      include: {
        authIdentities: {
          where: {
            provider: authProvider,
          },
        },
      },
    });

    // If user doesn't exist, create new user
    if (!user) {
      // For property managers, check subscription before registration
      // Note: OAuth signups should allow registration first, then select subscription
      // Only check subscription in production for OAuth (similar to email registration)
      const role = UserRole.PROPERTY_MANAGER; // Default role
      const nodeEnv = process.env.NODE_ENV || 'development';
      
      // Only check subscription in production, allow OAuth registration in development
      // OAuth users will select subscription after completing profile
      if (role === UserRole.PROPERTY_MANAGER && nodeEnv === 'production') {
        const hasSubscription = await this.checkPropertyManagerSubscription(email);
        if (!hasSubscription) {
          throw new BadRequestException(
            'Property managers must have an active subscription before registration',
          );
        }
      }

      // Create user, auth identity, and device in a transaction
      const newUser = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            fullName,
            role,
            isEmailVerified: true, // OAuth providers verify email
          },
        });

        await tx.userAuthIdentity.create({
          data: {
            userId: createdUser.id,
            provider: authProvider,
            providerUserId,
            lastLoginAt: new Date(),
          },
        });

        await tx.device.create({
          data: {
            userId: createdUser.id,
            ipAddress,
            userAgent,
            deviceFingerprint,
            isVerified: true, // OAuth is considered verified
          },
        });

        return createdUser;
      });

      // Fetch user with auth identities for consistency
      user = await this.prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          authIdentities: {
            where: {
              provider: authProvider,
            },
          },
        },
      });
    } else {
      // User exists - update or create auth identity
      const existingAuthIdentity = user.authIdentities[0];

      if (existingAuthIdentity) {
        // Update existing auth identity
        await this.prisma.userAuthIdentity.update({
          where: { id: existingAuthIdentity.id },
          data: {
            providerUserId,
            lastLoginAt: new Date(),
          },
        });
      } else {
        // Create new auth identity for this provider
        await this.prisma.userAuthIdentity.create({
          data: {
            userId: user.id,
            provider: authProvider,
            providerUserId,
            lastLoginAt: new Date(),
          },
        });
      }

      // Track device
      await this.trackDevice(user.id, ipAddress, userAgent, deviceFingerprint);
    }

    if (!user) {
      throw new NotFoundException('User not found after OAuth callback');
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
      },
      token,
    };
  }

  /**
   * Login with email and password
   */
  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        authIdentities: {
          where: {
            provider: AuthProvider.EMAIL_PASSWORD,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user has EMAIL_PASSWORD auth identity
    const emailPasswordIdentity = user.authIdentities.find(
      (identity) => identity.provider === AuthProvider.EMAIL_PASSWORD,
    );

    if (!emailPasswordIdentity || !emailPasswordIdentity.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(
      emailPasswordIdentity.passwordHash,
      password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active. Please activate your account.');
    }

    // Check if user is property manager
    if (user.role !== UserRole.PROPERTY_MANAGER) {
      throw new UnauthorizedException('Access denied. Property manager account required.');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in.');
    }

    // Track device and check if verification is needed
    const { isNewDevice } = await this.trackDevice(user.id, ipAddress, userAgent, deviceFingerprint);

    // If it's a new device, send device verification OTP
    if (isNewDevice) {
      await this.createAndSendOtp(
        user.id,
        user.email,
        user.fullName,
        OtpType.DEVICE_VERIFICATION,
        ipAddress,
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
        },
        requiresDeviceVerification: true,
        message: 'New device detected. OTP sent to your email for verification.',
      };
    }

    // Update last login time
    await this.prisma.userAuthIdentity.update({
      where: { id: emailPasswordIdentity.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = this.jwtService.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
      },
      token,
      requiresDeviceVerification: false,
    };
  }

  /**
   * Check if email already exists
   */
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  /**
   * Activate account with selected plan and create subscription
   */
  async activateAccount(userId: string, activateAccountDto: { planId: string; isYearly?: boolean }) {
    const { planId, isYearly } = activateAccountDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate subscription dates using date-fns for safe date arithmetic
    const startDate = new Date();
    const endDate = isYearly 
      ? addYears(startDate, 1)
      : addMonths(startDate, 1);
    
    // nextBillingDate is the same as endDate
    const nextBillingDate = endDate;

    // Create subscription and activate account in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Create subscription with TRIALING status (14-day trial)
      await tx.subscription.create({
        data: {
          userId: userId,
          planId,
          status: SubscriptionStatus.TRIALING,
          startDate,
          endDate,
          nextBillingDate,
        },
      });

      // Activate account (don't auto-verify email - user needs to verify OTP)
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          // Don't auto-verify email - user must verify OTP first
          // isEmailVerified: true,
        },
      });
    });

    // Send email verification OTP after activation
    try {
      await this.createAndSendOtp(
        userId,
        user.email,
        user.fullName,
        OtpType.EMAIL_VERIFICATION,
      );
    } catch (error) {
      // Log error but don't fail activation
      console.error('Failed to send OTP email after activation:', error);
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      message: 'Account activated successfully. Please verify your email with the OTP sent to your inbox.',
      token,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update user profile (for OAuth users completing registration)
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { phoneCountryCode, phoneNumber, country, state, pincode, address } = updateProfileDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user profile
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneCountryCode: phoneCountryCode || user.phoneCountryCode,
        phoneNumber: phoneNumber || user.phoneNumber,
        country: country || user.country,
        state: state || user.state,
        pincode: pincode || user.pincode,
        address: address || user.address,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      phoneCountryCode: updatedUser.phoneCountryCode,
      phoneNumber: updatedUser.phoneNumber,
      country: updatedUser.country,
      state: updatedUser.state,
      pincode: updatedUser.pincode,
      address: updatedUser.address,
      isEmailVerified: updatedUser.isEmailVerified,
      isActive: updatedUser.isActive,
    };
  }
}
