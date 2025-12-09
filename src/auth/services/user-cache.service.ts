import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import { User, Subscription } from '@prisma/client';

interface CachedUserData {
  user: User & {
    subscriptions: Subscription[];
  };
  cachedAt: number;
}

@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name);
  private readonly loggingEnabled: boolean;
  private cache: LRUCache<string, CachedUserData>;
  private currentMaxSize: number;
  private readonly INITIAL_MAX_SIZE = 15 * 1024 * 1024;
  private readonly MAX_LIMIT_SIZE = 100 * 1024 * 1024;
  private readonly EXPANSION_SIZE = 10 * 1024 * 1024;
  private readonly EXPANSION_THRESHOLD = 0.9;

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    this.loggingEnabled = configService.get<boolean>('LOG_USER_CACHE', nodeEnv === 'development');

    this.currentMaxSize = this.INITIAL_MAX_SIZE;
    this.cache = this.createCache(this.currentMaxSize);
    
    if (this.loggingEnabled) {
    this.logger.log(`UserCache initialized with maxSize: ${this.formatBytes(this.currentMaxSize)}`);
    }
  }

  private createCache(maxSize: number): LRUCache<string, CachedUserData> {
    return new LRUCache<string, CachedUserData>({
      maxSize,
      ttl: 5 * 60 * 1000,
      updateAgeOnGet: true,
      allowStale: false,
      sizeCalculation: (value) => {
        const userSize = JSON.stringify(value.user).length;
        return userSize;
      },
    });
  }

  private expandCacheIfNeeded(): void {
    const currentSize = this.cache.calculatedSize || 0;
    const usageRatio = currentSize / this.currentMaxSize;

    if (usageRatio >= this.EXPANSION_THRESHOLD && this.currentMaxSize < this.MAX_LIMIT_SIZE) {
      const newMaxSize = Math.min(
        this.currentMaxSize + this.EXPANSION_SIZE,
        this.MAX_LIMIT_SIZE,
      );

      if (newMaxSize > this.currentMaxSize) {
        if (this.loggingEnabled) {
        this.logger.log(
          `Cache expansion triggered: currentSize=${this.formatBytes(currentSize)}, usageRatio=${(usageRatio * 100).toFixed(1)}%, expanding from ${this.formatBytes(this.currentMaxSize)} to ${this.formatBytes(newMaxSize)}`,
        );
        }

        const oldCache = this.cache;
        const newCache = this.createCache(newMaxSize);

        for (const [key, value] of oldCache.entries()) {
          newCache.set(key, value);
        }

        this.cache = newCache;
        this.currentMaxSize = newMaxSize;

        if (this.loggingEnabled) {
        this.logger.log(
          `Cache expanded successfully: migrated ${oldCache.size} entries, new maxSize=${this.formatBytes(this.currentMaxSize)}`,
        );
        }
      }
    }
  }

  get(userId: string): CachedUserData | undefined {
    const cached = this.cache.get(userId);
    if (this.loggingEnabled) {
    if (cached) {
      const age = Date.now() - cached.cachedAt;
      this.logger.log(
        `[CACHE HIT] userId: ${userId}, email: ${cached.user.email}, age: ${Math.round(age / 1000)}s, size: ${this.getSizeInBytes(cached)} bytes`,
      );
    } else {
      this.logger.debug(`[CACHE MISS] userId: ${userId}`);
      }
    }
    return cached;
  }

  set(userId: string, userData: User & { subscriptions: Subscription[] }): void {
    this.expandCacheIfNeeded();

    const size = this.getSizeInBytes({ user: userData, cachedAt: Date.now() });
    this.cache.set(userId, {
      user: userData,
      cachedAt: Date.now(),
    });

    if (this.loggingEnabled) {
    const stats = this.getStats();
    const usagePercent = ((stats.calculatedSize || 0) / this.currentMaxSize) * 100;
    this.logger.log(
      `[CACHE SET] userId: ${userId}, email: ${userData.email}, size: ${this.formatBytes(size)}, totalEntries: ${stats.size}, totalSize: ${this.formatBytes(stats.calculatedSize || 0)}/${this.formatBytes(this.currentMaxSize)} (${usagePercent.toFixed(1)}%)`,
    );
    }
  }

  delete(userId: string): void {
    const cached = this.cache.get(userId);
    if (this.loggingEnabled && cached) {
      this.logger.log(`[CACHE DELETE] userId: ${userId}, email: ${cached.user.email}`);
    }
    this.cache.delete(userId);
  }

  clear(): void {
    const sizeBefore = this.cache.size;
    this.cache.clear();
    if (this.loggingEnabled) {
    this.logger.warn(`[CACHE CLEAR] Cleared ${sizeBefore} entries`);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      maxSize: this.currentMaxSize,
      usagePercent: ((this.cache.calculatedSize || 0) / this.currentMaxSize) * 100,
    };
  }

  private getSizeInBytes(data: CachedUserData): number {
    return JSON.stringify(data.user).length;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

