import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from './jwt.service';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { AuthProvider, UserRole, OtpType } from '@prisma/client';

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
   * Generate a random OTP code
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Check if property manager has an active subscription
   */
  private async checkPropertyManagerSubscription(email: string): Promise<boolean> {
    // For property managers, we need to check if they have a subscription
    // This could be done by checking if there's a subscription record with their email
    // or by checking a separate subscription table before user creation
    // For now, we'll check if a subscription exists for this email
    // You may need to adjust this based on your subscription flow
    
    // Option 1: Check if subscription exists by email (if you have a pre-registration subscription table)
    // Option 2: For now, we'll allow registration but require subscription check
    // This is a placeholder - adjust based on your subscription system
    
    // If you have a separate table for pending subscriptions, check here
    // For this implementation, we'll assume subscription is checked via a separate endpoint
    // and stored in a way that we can verify before registration
    
    return true; // Placeholder - implement your subscription check logic
  }

  /**
   * Track device and IP address for a user
   */
  private async trackDevice(
    userId: bigint,
    ipAddress: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ): Promise<{ isNewDevice: boolean; deviceId: bigint }> {
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
    userId: bigint,
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
    if (role === UserRole.PROPERTY_MANAGER) {
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

      // Create and send email verification OTP
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

      // Send OTP email (outside transaction to avoid rollback on email failure)
      try {
        await this.emailService.sendOtpEmail(email, otpCode, fullName);
      } catch (error) {
        // Log error but don't fail registration
        console.error('Failed to send OTP email:', error);
      }

      return newUser;
    });

    // Return user data without sensitive information
    return {
      id: user.id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      message: 'Registration successful. Please check your email for OTP verification.',
    };
  }

  /**
   * Verify email OTP
   */
  async verifyEmailOtp(userId: string, code: string): Promise<void> {
    const userIdBigInt = BigInt(userId);
    const now = new Date();

    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: userIdBigInt,
        code,
        type: OtpType.EMAIL_VERIFICATION,
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Mark OTP as used and verify user email
    await this.prisma.$transaction(async (tx) => {
      await tx.otp.update({
        where: { id: otp.id },
        data: { isUsed: true },
      });

      await tx.user.update({
        where: { id: userIdBigInt },
        data: { isEmailVerified: true },
      });
    });
  }

  /**
   * Verify device OTP
   */
  async verifyDeviceOtp(userId: string, code: string, ipAddress: string): Promise<void> {
    const userIdBigInt = BigInt(userId);
    const now = new Date();

    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: userIdBigInt,
        code,
        type: OtpType.DEVICE_VERIFICATION,
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Mark OTP as used and verify device
    await this.prisma.$transaction(async (tx) => {
      await tx.otp.update({
        where: { id: otp.id },
        data: { isUsed: true },
      });

      await tx.device.updateMany({
        where: {
          userId: userIdBigInt,
          ipAddress,
        },
        data: { isVerified: true },
      });
    });
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
    const userIdBigInt = BigInt(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userIdBigInt },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { isNewDevice } = await this.trackDevice(
      userIdBigInt,
      ipAddress,
      userAgent,
      deviceFingerprint,
    );

    if (isNewDevice) {
      await this.createAndSendOtp(
        userIdBigInt,
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
      const role = UserRole.PROPERTY_MANAGER; // Default role
      if (role === UserRole.PROPERTY_MANAGER) {
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
      userId: user.id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
      },
      token,
    };
  }
}
