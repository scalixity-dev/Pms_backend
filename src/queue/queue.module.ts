import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { FileProcessingQueueProcessor } from './processors/file-processing-queue.processor';
import { BackgroundTasksQueueProcessor } from './processors/background-tasks-queue.processor';
import { QueueService } from './queue.service';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL environment variable is required for BullMQ');
        }

        let connection: any;

        try {
          if (redisUrl.includes('://')) {
            const url = new URL(redisUrl);
            connection = {
              host: url.hostname,
              port: parseInt(url.port || '6379', 10),
              username: url.username || undefined,
              password: url.password || undefined,
              db: url.pathname.length > 1 ? parseInt(url.pathname.slice(1), 10) : 0,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            };

            if (url.protocol === 'rediss:') {
              connection.tls = {
                servername: url.hostname,
              };
            }
          } else {
            // Fallback for simple host:port string
            const parts = redisUrl.split(':');
            connection = {
              host: parts[0],
              port: parseInt(parts[1] || '6379', 10),
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            };
          }
        } catch (error) {
          throw new Error(`Invalid REDIS_URL: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: {
              age: 24 * 3600,
              count: 1000,
            },
            removeOnFail: {
              age: 7 * 24 * 3600,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'email',
        defaultJobOptions: {
          priority: 1,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'file-processing',
        defaultJobOptions: {
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
      {
        name: 'background-tasks',
        defaultJobOptions: {
          priority: 10,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
        },
      },
    ),
    forwardRef(() => EmailModule),
    PrismaModule,
  ],
  providers: [
    EmailQueueProcessor,
    FileProcessingQueueProcessor,
    BackgroundTasksQueueProcessor,
    QueueService,
  ],
  exports: [BullModule, QueueService],
})
export class QueueModule { }

