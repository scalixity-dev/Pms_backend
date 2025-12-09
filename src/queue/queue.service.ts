import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData } from './processors/email-queue.processor';
import { FileProcessingJobData } from './processors/file-processing-queue.processor';
import { BackgroundTaskJobData } from './processors/background-tasks-queue.processor';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('file-processing') private readonly fileProcessingQueue: Queue,
    @InjectQueue('background-tasks') private readonly backgroundTasksQueue: Queue,
  ) {}

  async addEmailJob(data: EmailJobData, options?: { priority?: number; delay?: number }): Promise<string> {
    const job = await this.emailQueue.add('send-email', data, {
      priority: options?.priority || 1,
      delay: options?.delay || 0,
    });

    this.logger.log(`Email job added | Job ID: ${job.id} | Type: ${data.type} | To: ${data.to}`);
    return job.id!;
  }

  async addFileProcessingJob(
    data: FileProcessingJobData,
    options?: { priority?: number; delay?: number },
  ): Promise<string> {
    const job = await this.fileProcessingQueue.add('process-file', data, {
      priority: options?.priority || 5,
      delay: options?.delay || 0,
    });

    this.logger.log(
      `File processing job added | Job ID: ${job.id} | Type: ${data.type} | User: ${data.userId}`,
    );
    return job.id!;
  }

  async addBackgroundTaskJob(
    data: BackgroundTaskJobData,
    options?: { priority?: number; delay?: number },
  ): Promise<string> {
    const job = await this.backgroundTasksQueue.add('process-task', data, {
      priority: options?.priority || 10,
      delay: options?.delay || 0,
    });

    this.logger.log(
      `Background task job added | Job ID: ${job.id} | Type: ${data.type} | User: ${data.userId || 'system'}`,
    );
    return job.id!;
  }

  async getEmailJobStatus(jobId: string): Promise<any> {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }

  async getFileProcessingJobStatus(jobId: string): Promise<any> {
    const job = await this.fileProcessingQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }

  async getBackgroundTaskJobStatus(jobId: string): Promise<any> {
    const job = await this.backgroundTasksQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }
}

