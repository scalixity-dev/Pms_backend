import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private readonly warmingEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.warmingEnabled = configService.get<boolean>('CACHE_WARMING_ENABLED', false);
  }

  async onModuleInit() {
    if (this.warmingEnabled) {
      this.logger.log('Cache warming enabled - starting background warmup...');
      setImmediate(() => this.warmCache().catch((err) => {
        this.logger.error(`Cache warming failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }));
    }
  }

  async warmCache(): Promise<void> {
    if (!this.cache['redis'].isAvailable()) {
      this.logger.warn('Redis not available, skipping cache warming');
      return;
    }

    try {
      await this.warmHotProperties();
      await this.warmActiveListings();
      await this.warmRecentMaintenanceRequests();
      this.logger.log('Cache warming completed successfully');
    } catch (error) {
      this.logger.error(`Cache warming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async warmHotProperties(): Promise<void> {
    try {
      const hotProperties = await this.prisma.property.findMany({
        where: {
          status: 'ACTIVE',
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          manager: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          address: true,
          photos: {
            take: 1,
            select: {
              id: true,
              photoUrl: true,
              isPrimary: true,
            },
          },
        },
        take: 50,
        orderBy: {
          updatedAt: 'desc',
        },
      });

      const groupedByManager = new Map<string, typeof hotProperties>();
      for (const property of hotProperties) {
        const managerId = property.managerId;
        if (!groupedByManager.has(managerId)) {
          groupedByManager.set(managerId, []);
        }
        groupedByManager.get(managerId)!.push(property);
      }

      for (const [managerId, properties] of groupedByManager) {
        const cacheKey = this.cache.propertyListKey(managerId, false);
        await this.cache.set(cacheKey, properties, this.cache.getTTL('PROPERTY_LIST'));
      }

      this.logger.log(`Warmed ${hotProperties.length} hot properties for ${groupedByManager.size} managers`);
    } catch (error) {
      this.logger.error(`Error warming hot properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async warmActiveListings(): Promise<void> {
    try {
      const activeListings = await this.prisma.listing.findMany({
        where: {
          isActive: true,
          listingStatus: 'ACTIVE',
        },
        include: {
          property: {
            select: {
              id: true,
              propertyName: true,
              managerId: true,
              address: {
                select: {
                  city: true,
                  stateRegion: true,
                },
              },
            },
          },
        },
        take: 100,
        orderBy: {
          createdAt: 'desc',
        },
      });

      const groupedByManager = new Map<string, typeof activeListings>();
      for (const listing of activeListings) {
        const managerId = listing.property.managerId;
        if (!groupedByManager.has(managerId)) {
          groupedByManager.set(managerId, []);
        }
        groupedByManager.get(managerId)!.push(listing);
      }

      for (const [managerId, listings] of groupedByManager) {
        const cacheKey = this.cache.listingListKey(managerId);
        await this.cache.set(cacheKey, listings, this.cache.getTTL('LISTING_LIST'));
      }

      this.logger.log(`Warmed ${activeListings.length} active listings`);
    } catch (error) {
      this.logger.error(`Error warming active listings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async warmRecentMaintenanceRequests(): Promise<void> {
    try {
      const recentRequests = await this.prisma.maintenanceRequest.findMany({
        where: {
          status: {
            in: ['NEW', 'IN_PROGRESS', 'ASSIGNED'],
          },
          requestedAt: {
            gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          property: {
            select: {
              id: true,
              propertyName: true,
            },
          },
        },
        take: 100,
        orderBy: {
          requestedAt: 'desc',
        },
      });

      const groupedByManager = new Map<string, typeof recentRequests>();
      for (const request of recentRequests) {
        const managerId = request.managerId;
        if (!groupedByManager.has(managerId)) {
          groupedByManager.set(managerId, []);
        }
        groupedByManager.get(managerId)!.push(request);
      }

      for (const [managerId, requests] of groupedByManager) {
        const cacheKey = this.cache.maintenanceListKey(managerId);
        await this.cache.set(cacheKey, requests, this.cache.getTTL('MAINTENANCE_LIST'));
      }

      this.logger.log(`Warmed ${recentRequests.length} recent maintenance requests`);
    } catch (error) {
      this.logger.error(`Error warming maintenance requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async warmUserCache(userId: string): Promise<void> {
    if (!this.cache['redis'].isAvailable()) {
      return;
    }

    try {
      const propertyListInclude = {
        manager: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        address: true,
        amenities: true,
        photos: {
          select: {
            id: true,
            photoUrl: true,
            isPrimary: true,
          },
          take: 1,
        },
      };

      const properties = await this.prisma.property.findMany({
        where: { managerId: userId },
        include: propertyListInclude as Prisma.PropertyInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const cacheKey = this.cache.propertyListKey(userId, false);
      await this.cache.set(cacheKey, properties, this.cache.getTTL('PROPERTY_LIST'));
    } catch (error) {
      this.logger.error(`Error warming user cache for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

