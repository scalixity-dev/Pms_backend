import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly SLOW_QUERY_THRESHOLD_MS = 100;
  private readonly isDevelopment: boolean;
  private readonly loggingEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    const isDevelopment = nodeEnv === 'development';
    const loggingEnabled = configService.get<boolean>('LOG_PRISMA_QUERIES', isDevelopment);

    super({
      log: loggingEnabled
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
      errorFormat: 'pretty',
    });

    this.isDevelopment = isDevelopment;
    this.loggingEnabled = loggingEnabled;

    if (loggingEnabled) {
      this.setupQueryLogging();
    }
  }

  private setupQueryLogging(): void {
    this.$on('query' as never, (e: Prisma.QueryEvent) => {
      if (!this.loggingEnabled) return;

      const duration = e.duration;
      const isSlow = duration > this.SLOW_QUERY_THRESHOLD_MS;

      if (isSlow) {
        this.logger.warn(
          `SLOW QUERY [${duration}ms]: ${e.query} | Params: ${e.params}`,
        );
      } else {
        this.logger.debug(`Query [${duration}ms]: ${e.query.substring(0, 100)}...`);
      }
    });

    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.target);
    });

    this.$on('warn' as never, (e: Prisma.LogEvent) => {
      if (this.loggingEnabled) {
        this.logger.warn(`Prisma Warning: ${e.message}`);
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
    if (this.loggingEnabled) {
      this.logger.log('Prisma connected with query logging enabled');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

