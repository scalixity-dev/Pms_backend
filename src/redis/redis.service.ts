import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 3;

  constructor(private readonly configService: ConfigService) { }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured, Redis features will be disabled');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times >= this.maxConnectionAttempts) {
            this.logger.error(`Redis connection failed after ${this.maxConnectionAttempts} attempts`);
            this.isConnected = false;
            return null;
          }
          const delay = Math.min(times * 200, 2000);
          this.logger.warn(`Redis reconnecting attempt ${times}/${this.maxConnectionAttempts} in ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      this.client.on('connect', () => {
        this.logger.log('Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.logger.log('Redis client connected and ready');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error(`Redis connection error: ${error.message}`, error.stack);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', (delay) => {
        this.logger.warn(`Redis reconnecting in ${delay}ms`);
      });
    } catch (error) {
      this.logger.error(`Failed to initialize Redis client: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      this.isConnected = false;
      this.client = null;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Redis client disconnected');
      } catch (error) {
        this.logger.error(`Error disconnecting Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }

  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      this.logger.debug(`Redis not available, get operation skipped for key: ${key}`);
      return null;
    }

    try {
      const value = await this.client!.get(key);
      this.logger.debug(`Redis GET: key=${key}, found=${value !== null}, valueLength=${value ? value.length : 0}`);
      return value;
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.debug(`Redis not available, set operation skipped for key: ${key}`);
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, value);
        this.logger.debug(`Redis SETEX: key=${key}, ttl=${ttlSeconds}s`);
      } else {
        await this.client!.set(key, value);
        this.logger.debug(`Redis SET: key=${key}`);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.debug(`Redis not available, delete operation skipped for key: ${key}`);
      return false;
    }

    try {
      const result = await this.client!.del(key);
      this.logger.debug(`Redis DEL: key=${key}, deleted=${result > 0}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.debug(`Redis not available, exists check skipped for key: ${key}`);
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return -1;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis PING error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}

