import { Injectable, Logger } from '@nestjs/common';
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
  private readonly cache: LRUCache<string, CachedUserData>;

  constructor() {
    this.cache = new LRUCache<string, CachedUserData>({
      maxSize: 15 * 1024 * 1024,
      ttl: 5 * 60 * 1000,
      updateAgeOnGet: true,
      allowStale: false,
      sizeCalculation: (value) => {
        const userSize = JSON.stringify(value.user).length;
        return userSize;
      },
    });
  }

  get(userId: string): CachedUserData | undefined {
    const cached = this.cache.get(userId);
    if (cached) {
      const age = Date.now() - cached.cachedAt;
      this.logger.log(
        `[CACHE HIT] userId: ${userId}, email: ${cached.user.email}, age: ${Math.round(age / 1000)}s, size: ${this.getSizeInBytes(cached)} bytes`,
      );
    } else {
      this.logger.debug(`[CACHE MISS] userId: ${userId}`);
    }
    return cached;
  }

  set(userId: string, userData: User & { subscriptions: Subscription[] }): void {
    const size = this.getSizeInBytes({ user: userData, cachedAt: Date.now() });
    this.cache.set(userId, {
      user: userData,
      cachedAt: Date.now(),
    });
    const stats = this.getStats();
    this.logger.log(
      `[CACHE SET] userId: ${userId}, email: ${userData.email}, size: ${size} bytes, totalEntries: ${stats.size}, totalSize: ${this.formatBytes(stats.calculatedSize || 0)}`,
    );
  }

  delete(userId: string): void {
    const cached = this.cache.get(userId);
    if (cached) {
      this.logger.log(`[CACHE DELETE] userId: ${userId}, email: ${cached.user.email}`);
    }
    this.cache.delete(userId);
  }

  clear(): void {
    const sizeBefore = this.cache.size;
    this.cache.clear();
    this.logger.warn(`[CACHE CLEAR] Cleared ${sizeBefore} entries`);
  }

  getStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
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

