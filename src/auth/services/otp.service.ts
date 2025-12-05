import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OtpType } from '@prisma/client';

interface OtpData {
  code: string;
  userId: string;
  type: OtpType;
  expiresAt: string;
  createdAt: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly REDIS_KEY_PREFIX = 'otp:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  private getRedisKey(userId: string, type: OtpType): string {
    return `${this.REDIS_KEY_PREFIX}${userId}:${type}`;
  }

  async createOtp(
    userId: string,
    code: string,
    type: OtpType,
  ): Promise<{ success: boolean; usedRedis: boolean }> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);
    const ttlSeconds = this.OTP_EXPIRY_MINUTES * 60;

    const otpData: OtpData = {
      code,
      userId,
      type,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.invalidateExistingOtps(userId, type);

    const redisKey = this.getRedisKey(userId, type);
    const redisSuccess = await this.redis.set(redisKey, JSON.stringify(otpData), ttlSeconds);

    if (redisSuccess) {
      this.logger.log(`OTP stored in Redis: userId=${userId}, type=${type}, key=${redisKey}, ttl=${ttlSeconds}s`);
      return { success: true, usedRedis: true };
    }

    this.logger.warn(`Redis storage failed, falling back to database: userId=${userId}, type=${type}`);

    try {

      await this.prisma.otp.create({
        data: {
          userId,
          code,
          type,
          expiresAt,
          isUsed: false,
        },
      });

      this.logger.log(`OTP stored in database: userId=${userId}, type=${type}`);
      return { success: true, usedRedis: false };
    } catch (error) {
      this.logger.error(`Failed to store OTP in database: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async verifyOtp(
    userId: string,
    code: string,
    type: OtpType,
  ): Promise<{ valid: boolean; usedRedis: boolean; expired?: boolean; alreadyUsed?: boolean }> {
    const redisKey = this.getRedisKey(userId, type);
    const redisData = await this.redis.get(redisKey);

    this.logger.log(`OTP verification attempt: userId=${userId}, type=${type}, providedCode=${code.trim()}, redisKey=${redisKey}, redisDataExists=${redisData !== null}`);

    if (redisData) {
      try {
        const otpData: OtpData = JSON.parse(redisData);
        const expiresAt = new Date(otpData.expiresAt);
        const now = new Date();

        this.logger.log(`OTP data from Redis: storedCode=${otpData.code}, providedCode=${code.trim()}, expiresAt=${expiresAt.toISOString()}, now=${now.toISOString()}, expired=${expiresAt <= now}`);

        if (otpData.code !== code.trim()) {
          this.logger.warn(`OTP code mismatch in Redis: userId=${userId}, type=${type}, storedCode=${otpData.code}, providedCode=${code.trim()}`);
          return { valid: false, usedRedis: true };
        }

        if (expiresAt <= now) {
          this.logger.warn(`OTP expired in Redis: userId=${userId}, type=${type}, expiresAt=${expiresAt.toISOString()}, now=${now.toISOString()}`);
          await this.redis.del(redisKey);
          return { valid: false, usedRedis: true, expired: true };
        }

        await this.redis.del(redisKey);
        this.logger.log(`OTP verified and deleted from Redis: userId=${userId}, type=${type}, code=${code.trim()}`);

        return { valid: true, usedRedis: true };
      } catch (error) {
        this.logger.error(`Error parsing Redis OTP data: ${error instanceof Error ? error.message : 'Unknown error'}, redisData=${redisData}`, error instanceof Error ? error.stack : undefined);
        await this.redis.del(redisKey);
      }
    }

    this.logger.log(`OTP not found in Redis, checking database: userId=${userId}, type=${type}`);

    const now = new Date();
    const otp = await this.prisma.otp.findFirst({
      where: {
        userId,
        code: code.trim(),
        type,
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      this.logger.warn(`OTP not found in database (valid and unused): userId=${userId}, type=${type}`);

      const expiredOtp = await this.prisma.otp.findFirst({
        where: {
          userId,
          code: code.trim(),
          type,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (expiredOtp) {
        this.logger.log(`Found OTP in database but invalid: userId=${userId}, type=${type}, isUsed=${expiredOtp.isUsed}, expiresAt=${expiredOtp.expiresAt.toISOString()}, now=${now.toISOString()}`);

        if (expiredOtp.isUsed) {
          this.logger.warn(`OTP already used in database: userId=${userId}, type=${type}`);
          return { valid: false, usedRedis: false, alreadyUsed: true };
        } else if (expiredOtp.expiresAt <= now) {
          this.logger.warn(`OTP expired in database: userId=${userId}, type=${type}, expiresAt=${expiredOtp.expiresAt.toISOString()}`);
          return { valid: false, usedRedis: false, expired: true };
        }
      }

      return { valid: false, usedRedis: false };
    }

    this.logger.log(`OTP found in database: userId=${userId}, type=${type}, code=${otp.code}, expiresAt=${otp.expiresAt.toISOString()}`);

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    this.logger.log(`OTP verified and marked as used in database: userId=${userId}, type=${type}, code=${code.trim()}`);
    return { valid: true, usedRedis: false };
  }

  async invalidateExistingOtps(userId: string, type: OtpType): Promise<void> {
    const redisKey = this.getRedisKey(userId, type);
    const deleted = await this.redis.del(redisKey);
    if (deleted) {
      this.logger.debug(`Invalidated existing OTP in Redis: userId=${userId}, type=${type}`);
    }

    const result = await this.prisma.otp.updateMany({
      where: {
        userId,
        type,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Invalidated ${result.count} existing OTP(s) in database: userId=${userId}, type=${type}`);
    }
  }

  private async markOtpAsUsedInDb(userId: string, code: string, type: OtpType): Promise<void> {
    await this.prisma.otp.updateMany({
      where: {
        userId,
        code: code.trim(),
        type,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });
  }
}

