import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  private readonly TTL = {
    PROPERTY_LIST: 60,
    PROPERTY_DETAIL: 300,
    LISTING_LIST: 60,
    LISTING_DETAIL: 300,
    MAINTENANCE_LIST: 60,
    MAINTENANCE_DETAIL: 300,
    APPLICATION_LIST: 60,
    APPLICATION_DETAIL: 300,
    EQUIPMENT_LIST: 120,
    EQUIPMENT_DETAIL: 300,
    LEASING_DETAIL: 300,
    USER_DATA: 300,
    HOT_DATA: 1800,
  };

  private readonly KEY_PREFIXES = {
    PROPERTY: 'prop',
    PROPERTY_LIST: 'prop:list',
    LISTING: 'listing',
    LISTING_LIST: 'listing:list',
    MAINTENANCE: 'maint',
    MAINTENANCE_LIST: 'maint:list',
    APPLICATION: 'app',
    APPLICATION_LIST: 'app:list',
    EQUIPMENT: 'equip',
    EQUIPMENT_LIST: 'equip:list',
    LEASING: 'leasing',
    USER: 'user',
  };

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private buildKey(prefix: string, ...parts: (string | number | undefined)[]): string {
    const filtered = parts.filter((p) => p !== undefined && p !== null);
    return `${prefix}:${filtered.join(':')}`;
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.redis.isAvailable()) {
      return null;
    }

    try {
      const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
      const cached = await this.redis.get(fullKey);

      if (cached) {
        this.stats.hits++;
        return options?.serialize !== false ? JSON.parse(cached) : (cached as T);
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<boolean> {
    if (!this.redis.isAvailable()) {
      return false;
    }

    try {
      const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
      const serialized = options?.serialize !== false ? JSON.stringify(value) : String(value);
      const effectiveTtl = ttl ?? options?.ttl;

      // Use RedisService methods for Set operations
      const setKey = this.getTrackingSetKey(fullKey);
      
      if (setKey && effectiveTtl) {
        // Track cache key in Redis Set for efficient pattern-based deletion
        await Promise.all([
          this.redis.set(fullKey, serialized, effectiveTtl),
          this.redis.sadd(setKey, fullKey),
          this.redis.expire(setKey, effectiveTtl),
        ]);
      } else {
        await this.redis.set(fullKey, serialized, effectiveTtl);
        if (setKey) {
          // Add to tracking set without expiration if no TTL
          await this.redis.sadd(setKey, fullKey);
        }
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Get Redis Set key for tracking cache keys by pattern
   */
  private getTrackingSetKey(cacheKey: string): string | null {
    // Extract prefix pattern from cache key
    // e.g., "prop:list:userId" -> "cache:track:prop:list"
    const parts = cacheKey.split(':');
    if (parts.length < 2) return null;
    
    const prefix = parts.slice(0, 2).join(':');
    return `cache:track:${prefix}`;
  }

  async del(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.redis.isAvailable()) {
      return false;
    }

    try {
      const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
      const success = await this.redis.del(fullKey);
      if (success) {
        this.stats.deletes++;
      }
      return success;
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<number> {
    if (!this.redis.isAvailable()) {
      return 0;
    }

    try {
      const client = this.redis.getClient();
      if (!client) return 0;

      // Try to use Redis Set tracking for faster deletion
      // Pattern format: "prefix:*" -> tracking set "cache:track:prefix"
      const setMatch = pattern.match(/^([^:]+:[^:]+):\*$/);
      if (setMatch) {
        const trackingSetKey = `cache:track:${setMatch[1]}`;
        const keys = await this.redis.smembers(trackingSetKey);
        
        if (keys.length > 0) {
          // Filter keys that match the pattern (for safety)
          const matchingKeys = keys.filter(key => {
            // Simple pattern matching: convert "prefix:*" to regex
            const regexPattern = pattern.replace(/\*/g, '.*');
            return new RegExp(`^${regexPattern}$`).test(key);
          });

          if (matchingKeys.length > 0) {
            // Delete keys and remove from tracking set in parallel
            const [deleted] = await Promise.all([
              Promise.all(matchingKeys.map(key => this.del(key))).then(results => results.filter(Boolean).length),
              this.redis.srem(trackingSetKey, ...matchingKeys),
            ]);
            this.stats.deletes += deleted;
            return deleted;
          }
        }
      }

      // Fallback to SCAN for patterns not tracked in Sets
      const keys: string[] = [];
      const stream = client.scanStream({
        match: pattern,
        count: 100,
      });

      for await (const batch of stream) {
        keys.push(...batch);
      }

      if (keys.length === 0) return 0;

      const deleted = await client.del(...keys);
      this.stats.deletes += deleted;
      return deleted;
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for ${pattern}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl, options);
    return value;
  }

  propertyListKey(userId: string, includeListings?: boolean): string {
    return this.buildKey(this.KEY_PREFIXES.PROPERTY_LIST, userId, includeListings ? 'with-listings' : 'default');
  }

  propertyDetailKey(propertyId: string): string {
    return this.buildKey(this.KEY_PREFIXES.PROPERTY, propertyId);
  }

  listingListKey(userId?: string): string {
    return userId
      ? this.buildKey(this.KEY_PREFIXES.LISTING_LIST, userId)
      : this.buildKey(this.KEY_PREFIXES.LISTING_LIST, 'all');
  }

  listingDetailKey(listingId: string): string {
    return this.buildKey(this.KEY_PREFIXES.LISTING, listingId);
  }

  maintenanceListKey(userId?: string, propertyId?: string): string {
    if (propertyId) {
      return this.buildKey(this.KEY_PREFIXES.MAINTENANCE_LIST, 'property', propertyId);
    }
    return userId
      ? this.buildKey(this.KEY_PREFIXES.MAINTENANCE_LIST, userId)
      : this.buildKey(this.KEY_PREFIXES.MAINTENANCE_LIST, 'all');
  }

  maintenanceDetailKey(requestId: string): string {
    return this.buildKey(this.KEY_PREFIXES.MAINTENANCE, requestId);
  }

  applicationListKey(userId?: string, leasingId?: string): string {
    if (leasingId) {
      return this.buildKey(this.KEY_PREFIXES.APPLICATION_LIST, 'leasing', leasingId);
    }
    return userId
      ? this.buildKey(this.KEY_PREFIXES.APPLICATION_LIST, userId)
      : this.buildKey(this.KEY_PREFIXES.APPLICATION_LIST, 'all');
  }

  applicationDetailKey(applicationId: string): string {
    return this.buildKey(this.KEY_PREFIXES.APPLICATION, applicationId);
  }

  equipmentListKey(userId?: string, propertyId?: string): string {
    if (propertyId) {
      return this.buildKey(this.KEY_PREFIXES.EQUIPMENT_LIST, 'property', propertyId);
    }
    return userId
      ? this.buildKey(this.KEY_PREFIXES.EQUIPMENT_LIST, userId)
      : this.buildKey(this.KEY_PREFIXES.EQUIPMENT_LIST, 'all');
  }

  equipmentDetailKey(equipmentId: string): string {
    return this.buildKey(this.KEY_PREFIXES.EQUIPMENT, equipmentId);
  }

  leasingDetailKey(leasingId: string): string {
    return this.buildKey(this.KEY_PREFIXES.LEASING, leasingId);
  }

  async invalidateProperty(userId: string, propertyId?: string): Promise<void> {
    const keysToDelete: string[] = [
      this.propertyListKey(userId, true),
      this.propertyListKey(userId, false),
    ];

    if (propertyId) {
      keysToDelete.push(this.propertyDetailKey(propertyId));
    }

    await Promise.all(keysToDelete.map((key) => this.del(key)));

    if (propertyId) {
      await Promise.all([
        this.delPattern(`${this.KEY_PREFIXES.LISTING_LIST}:*`),
        this.delPattern(`${this.KEY_PREFIXES.MAINTENANCE_LIST}:*`),
        this.delPattern(`${this.KEY_PREFIXES.EQUIPMENT_LIST}:*`),
      ]);
    }
  }

  async invalidateListing(userId: string, listingId?: string): Promise<void> {
    const keysToDelete: string[] = [this.listingListKey(userId)];

    if (listingId) {
      keysToDelete.push(this.listingDetailKey(listingId));
    }

    await Promise.all(keysToDelete.map((key) => this.del(key)));
  }

  async invalidateMaintenance(userId: string, requestId?: string, propertyId?: string): Promise<void> {
    const keysToDelete: string[] = [this.maintenanceListKey(userId)];

    if (propertyId) {
      keysToDelete.push(this.maintenanceListKey(undefined, propertyId));
    }

    if (requestId) {
      keysToDelete.push(this.maintenanceDetailKey(requestId));
    }

    await Promise.all(keysToDelete.map((key) => this.del(key)));
  }

  async invalidateApplication(userId: string, applicationId?: string, leasingId?: string): Promise<void> {
    const keysToDelete: string[] = [this.applicationListKey(userId)];

    if (leasingId) {
      keysToDelete.push(this.applicationListKey(undefined, leasingId));
    }

    if (applicationId) {
      keysToDelete.push(this.applicationDetailKey(applicationId));
    }

    await Promise.all(keysToDelete.map((key) => this.del(key)));
  }

  async invalidateEquipment(userId: string, equipmentId?: string, propertyId?: string): Promise<void> {
    const keysToDelete: string[] = [this.equipmentListKey(userId)];

    if (propertyId) {
      keysToDelete.push(this.equipmentListKey(undefined, propertyId));
    }

    if (equipmentId) {
      keysToDelete.push(this.equipmentDetailKey(equipmentId));
    }

    await Promise.all(keysToDelete.map((key) => this.del(key)));
  }

  getTTL(type: keyof typeof CacheService.prototype.TTL): number {
    return this.TTL[type];
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
  }
}

