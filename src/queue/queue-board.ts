import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

let emailQueue: Queue | null = null;
let fileProcessingQueue: Queue | null = null;
let backgroundTasksQueue: Queue | null = null;

export function initializeQueues(configService: ConfigService): void {
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
      const parts = redisUrl.split(':');
      connection = {
        host: parts[0],
        port: parseInt(parts[1] || '6379', 10),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }
  } catch (error) {
    throw new Error(`Invalid REDIS_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  emailQueue = new Queue('email', { connection });
  fileProcessingQueue = new Queue('file-processing', { connection });
  backgroundTasksQueue = new Queue('background-tasks', { connection });
}

export function getBullBoardQueues(): Queue[] {
  const queues: Queue[] = [];

  if (emailQueue) queues.push(emailQueue);
  if (fileProcessingQueue) queues.push(fileProcessingQueue);
  if (backgroundTasksQueue) queues.push(backgroundTasksQueue);

  return queues;
}

