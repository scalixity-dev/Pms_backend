import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '../jwt.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, SubscriptionStatus } from '@prisma/client';
import { UserCacheService } from '../services/user-cache.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userCache: UserCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Try to get token from cookies first (for browser requests)
    let token = request.cookies?.['access_token'];
    
    // If no cookie token, try Authorization header (for API clients like Postman)
    if (!token) {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token);

      if (!payload || !payload.userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Verify user exists and is active and caching logic too
      const cachedData = this.userCache.get(payload.userId);
      let user = cachedData?.user;

      if (!user) {
        // Optimized query: fetch full user but filter subscriptions to only active/trialing
        // Limiting to 1 subscription reduces data transfer while maintaining type compatibility
        const dbUser = await this.prisma.user.findUnique({
          where: { id: payload.userId },
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

        if (!dbUser) {
          throw new UnauthorizedException('User not found');
        }

        user = dbUser;
        this.userCache.set(payload.userId, user);
      }

      // Type guard: ensure user is defined (should never be undefined after this point)
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Get the route path to determine if checks should be skipped
      // These endpoints are used during OAuth signup flow before account is fully activated
      const url = request.url || '';
      const isProfileUpdate = url.includes('/auth/profile') && request.method === 'PATCH';
      const isGetCurrentUser = url.includes('/auth/me') && request.method === 'GET';

      // Skip isActive and subscription checks for profile update and getCurrentUser endpoints
      // These endpoints are used during OAuth signup flow before subscription is selected
      if (!isProfileUpdate && !isGetCurrentUser) {
        if (!user.isActive) {
          throw new UnauthorizedException('Account is not active');
        }
      }

      // Check if user is property manager
      if (user.role !== UserRole.PROPERTY_MANAGER) {
        throw new UnauthorizedException(
          'Access denied. Property manager account required.',
        );
      }

      // Skip subscription check for profile update and getCurrentUser endpoints
      if (!isProfileUpdate && !isGetCurrentUser) {
        // Check if user has an active subscription
        if (!user.subscriptions || user.subscriptions.length === 0) {
          throw new UnauthorizedException(
            'No active subscription found. Please activate your account.',
          );
        }

        const subscription = user.subscriptions[0];
        const now = new Date();

        // Check if subscription is still valid
        if (subscription.endDate && subscription.endDate < now) {
          throw new UnauthorizedException(
            'Subscription has expired. Please renew your subscription.',
          );
        }
      }

      // Attach user to request
      request['user'] = {
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

