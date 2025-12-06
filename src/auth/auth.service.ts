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
import { UserCacheService } from './services/user-cache.service';
import { OtpService } from './services/otp.service';
import { QueueService } from '../queue/queue.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as argon2 from 'argon2';
import { AuthProvider, UserRole, OtpType, SubscriptionStatus } from '@prisma/client';
import { randomInt, randomBytes } from 'crypto';
import { addYears, addMonths, addDays } from 'date-fns';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly OTP_LENGTH = 6;
  private readonly DEVICE_TOKEN_EXPIRY_DAYS = 90;
  private readonly DEVICE_TOKEN_LENGTH = 32;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly userCache: UserCacheService,
    private readonly otpService: OtpService,
    private readonly queueService: QueueService,
  ) { }

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
   * Generate a secure random device token
   */
  private generateDeviceToken(): string {
    return randomBytes(this.DEVICE_TOKEN_LENGTH).toString('hex');
  }

  /**
   * Hash device token using argon2
   */
  private async hashDeviceToken(token: string): Promise<string> {
    return argon2.hash(token);
  }

  /**
   * Verify device token hash
   */
  private async verifyDeviceTokenHash(token: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, token);
    } catch {
      return false;
    }
  }

  /**
   * Validate device token from cookie
   */
  async validateDeviceToken(
    userId: string,
    deviceToken: string,
    deviceFingerprint?: string,
  ): Promise<{ isValid: boolean; deviceId?: string; requiresFingerprintMatch?: boolean }> {
    if (!deviceToken) {
      return { isValid: false };
    }

    // Find all devices for this user with non-revoked, non-expired tokens
    const devices = await this.prisma.device.findMany({
      where: {
        userId,
        deviceTokenHash: { not: null },
        isRevoked: false,
        OR: [
          { tokenExpiresAt: null },
          { tokenExpiresAt: { gt: new Date() } },
        ],
      },
    });

    // Try to verify the token against each device's stored hash
    for (const device of devices) {
      if (!device.deviceTokenHash) continue;

      const isValid = await this.verifyDeviceTokenHash(deviceToken, device.deviceTokenHash);

      if (isValid) {
        // Token matches this device
        // Check if fingerprint is provided and matches
        if (deviceFingerprint && device.deviceFingerprint) {
          const fingerprintMatches = device.deviceFingerprint === deviceFingerprint;
          if (!fingerprintMatches) {
            // Fingerprint doesn't match - require OTP but token is technically valid
            return { isValid: true, deviceId: device.id, requiresFingerprintMatch: true };
          }
        }

        // Update last seen
        await this.prisma.device.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        });

        return { isValid: true, deviceId: device.id };
      }
    }

    // No matching token found
    return { isValid: false };
  }

  /**
   * Create or update device token
   * If existingDeviceToken is provided, reuse it instead of generating a new one
   */
  async createOrUpdateDeviceToken(
    userId: string,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
    existingDeviceToken?: string,
  ): Promise<{ deviceToken: string; deviceId: string }> {
    let deviceToken: string;
    const tokenExpiresAt = addDays(new Date(), this.DEVICE_TOKEN_EXPIRY_DAYS);

    if (existingDeviceToken) {
      // Reuse existing token from cookie - verify against stored hashes
      deviceToken = existingDeviceToken;

      // Query all devices for this user to find a matching token hash
      const userDevices = await this.prisma.device.findMany({
        where: {
          userId,
          deviceTokenHash: { not: null },
        },
      });

      // Iterate through devices and verify the token against stored hashes
      for (const device of userDevices) {
        if (!device.deviceTokenHash) continue;

        const isMatch = await this.verifyDeviceTokenHash(deviceToken, device.deviceTokenHash);
        if (isMatch) {
          // Found matching device - update and reuse it
          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              ipAddress,
              userAgent,
              deviceFingerprint,
              tokenExpiresAt,
              isRevoked: false,
              isVerified: true,
              lastSeenAt: new Date(),
            },
          });
          return { deviceToken, deviceId: device.id };
        }
      }

      // No matching device found - create new device with hashed token
      const tokenHash = await this.hashDeviceToken(deviceToken);
      const newDevice = await this.prisma.device.create({
        data: {
          userId,
          ipAddress,
          userAgent,
          deviceFingerprint,
          deviceTokenHash: tokenHash,
          tokenExpiresAt,
          isVerified: true,
          isRevoked: false,
        },
      });
      return { deviceToken, deviceId: newDevice.id };
    } else {
      // Generate new token
      deviceToken = this.generateDeviceToken();
      const tokenHash = await this.hashDeviceToken(deviceToken);

      // Create new device with token hash
      const newDevice = await this.prisma.device.create({
        data: {
          userId,
          ipAddress,
          userAgent,
          deviceFingerprint,
          deviceTokenHash: tokenHash,
          tokenExpiresAt,
          isVerified: true,
          isRevoked: false,
        },
      });
      return { deviceToken, deviceId: newDevice.id };
    }
  }

  /**
   * Revoke device token
   */
  async revokeDeviceToken(userId: string, deviceToken: string): Promise<void> {
    // Find all devices for this user with tokens
    const devices = await this.prisma.device.findMany({
      where: {
        userId,
        deviceTokenHash: { not: null },
        isRevoked: false,
      },
    });

    // Try to verify the token against each device's stored hash
    for (const device of devices) {
      if (!device.deviceTokenHash) continue;

      const isValid = await this.verifyDeviceTokenHash(deviceToken, device.deviceTokenHash);

      if (isValid) {
        // Revoke this device's token
        await this.prisma.device.update({
          where: { id: device.id },
          data: { isRevoked: true },
        });
        return;
      }
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

    const { success, usedRedis } = await this.otpService.createOtp(userId, otpCode, type);

    if (!success) {
      throw new Error('Failed to store OTP');
    }

    // Send OTP via email queue (non-blocking)
    if (type === OtpType.EMAIL_VERIFICATION) {
      await this.queueService.addEmailJob({
        type: 'otp',
        to: email,
        otpCode,
        fullName,
      }, { priority: 1 });
    } else if (type === OtpType.DEVICE_VERIFICATION && ipAddress) {
      await this.queueService.addEmailJob({
        type: 'device-verification',
        to: email,
        otpCode,
        fullName,
        ipAddress,
      }, { priority: 1 });
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

      return { newUser };
    });

    // Create and send OTP email (outside transaction to avoid rollback on email failure)
    try {
      const otpCode = this.generateOtp();
      await this.otpService.createOtp(user.newUser.id, otpCode, OtpType.EMAIL_VERIFICATION);
      await this.queueService.addEmailJob({
        type: 'otp',
        to: email,
        otpCode,
        fullName,
      }, { priority: 1 });
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

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.otpService.verifyOtp(userId, code, OtpType.EMAIL_VERIFICATION);

    if (!result.valid) {
      if (result.expired) {
        throw new BadRequestException('This OTP code has expired. Please request a new code.');
      }
      if (result.alreadyUsed) {
        throw new BadRequestException('This OTP code has already been used. Please request a new code.');
      }
      throw new BadRequestException('Invalid OTP code. Please check the code and try again, or request a new code.');
    }

    // Verify user email
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    this.userCache.delete(userId);
  }

  /**
   * Verify device OTP
   */
  async verifyDeviceOtp(
    userId: string,
    code: string,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
    existingDeviceToken?: string,
  ): Promise<{ token: string; deviceToken: string }> {
    // Validate code format
    if (!code || typeof code !== 'string' || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new BadRequestException('OTP code must be exactly 6 digits');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.otpService.verifyOtp(userId, code, OtpType.DEVICE_VERIFICATION);

    if (!result.valid) {
      if (result.expired) {
        throw new BadRequestException('This OTP code has expired. Please request a new code.');
      }
      if (result.alreadyUsed) {
        throw new BadRequestException('This OTP code has already been used. Please request a new code.');
      }
      throw new BadRequestException('Invalid OTP code. Please check the code and try again, or request a new code.');
    }

    // Create or update device token
    // If existingDeviceToken is provided (from cookie), reuse it instead of generating new one
    const { deviceToken } = await this.createOrUpdateDeviceToken(
      userId,
      ipAddress,
      userAgent,
      deviceFingerprint,
      existingDeviceToken, // Reuse existing token if cookie exists
    );

    // Generate JWT token after successful device verification
    const jwtToken = this.jwtService.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { token: jwtToken, deviceToken };
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
    existingDeviceToken?: string,
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

      // Track device (but don't create device token yet - will be done below)
      await this.trackDevice(user.id, ipAddress, userAgent, deviceFingerprint);
    }

    if (!user) {
      throw new NotFoundException('User not found after OAuth callback');
    }

    // Create or update device token
    // If existingDeviceToken is provided (from cookie), reuse it instead of generating new one
    const { deviceToken } = await this.createOrUpdateDeviceToken(
      user.id,
      ipAddress,
      userAgent,
      deviceFingerprint,
      existingDeviceToken, // Reuse existing token if cookie exists
    );

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
      deviceToken, // Return device token so controller can set cookie if needed
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
    deviceToken?: string,
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

    // Check device token if provided
    if (deviceToken) {
      const tokenValidation = await this.validateDeviceToken(user.id, deviceToken, deviceFingerprint);

      if (tokenValidation.isValid && !tokenValidation.requiresFingerprintMatch) {
        // Valid token and fingerprint matches - skip OTP, allow login
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
          deviceToken: deviceToken, // Return same token to keep cookie
        };
      }
      // Token exists but invalid or fingerprint mismatch - require OTP
    }

    // No valid device token - require OTP verification
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
      message: 'Device verification required. OTP sent to your email.',
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

    this.userCache.delete(userId);

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

    this.userCache.delete(userId);

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
