import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { CacheWarmingService } from './cache-warming.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RedisService, CacheService, CacheWarmingService],
  exports: [RedisService, CacheService, CacheWarmingService],
})
export class RedisModule {}

