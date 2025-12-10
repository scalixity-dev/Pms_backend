import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BackgroundTaskJobData {
  type: 'report-generation' | 'data-cleanup' | 'notification' | 'analytics' | 'custom';
  userId?: string;
  parameters?: Record<string, any>;
}

@Processor('background-tasks', {
  concurrency: 3,
  limiter: {
    max: 20,
    duration: 60000,
  },
})
export class BackgroundTasksQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(BackgroundTasksQueueProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<BackgroundTaskJobData>): Promise<any> {
    const startTime = Date.now();
    const { type, userId, parameters } = job.data;
    const jobOptions = {
      id: job.id,
      name: job.name,
      attempts: job.opts.attempts,
      attemptsMade: job.attemptsMade,
      priority: job.opts.priority,
      delay: job.opts.delay,
      timestamp: job.timestamp,
      createdAt: new Date(job.timestamp).toISOString(),
    };

    this.logger.log(
      `[BACKGROUND TASKS QUEUE] Job started | ` +
      `ID: ${job.id} | ` +
      `Type: ${type} | ` +
      `User: ${userId || 'system'} | ` +
      `Attempt: ${job.attemptsMade + 1}/${job.opts.attempts} | ` +
      `Priority: ${job.opts.priority || 'default'} | ` +
      `Parameters: ${JSON.stringify(parameters || {})} | ` +
      `Options: ${JSON.stringify(jobOptions)}`,
    );

    try {
      let result: any;
      
      switch (type) {
        case 'report-generation':
          this.logger.log(
            `[BACKGROUND TASKS QUEUE] Generating report | ` +
            `Job ID: ${job.id} | ` +
            `User: ${userId || 'system'}`,
          );
          result = await this.generateReport(job, userId, parameters);
          break;

        case 'data-cleanup':
          this.logger.log(
            `[BACKGROUND TASKS QUEUE] Cleaning up data | ` +
            `Job ID: ${job.id}`,
          );
          result = await this.cleanupData(job, parameters);
          break;

        case 'notification':
          this.logger.log(
            `[BACKGROUND TASKS QUEUE] Sending notification | ` +
            `Job ID: ${job.id} | ` +
            `User: ${userId || 'system'}`,
          );
          result = await this.sendNotification(job, userId, parameters);
          break;

        case 'analytics':
          this.logger.log(
            `[BACKGROUND TASKS QUEUE] Processing analytics | ` +
            `Job ID: ${job.id}`,
          );
          result = await this.processAnalytics(job, parameters);
          break;

        case 'custom':
          this.logger.log(
            `[BACKGROUND TASKS QUEUE] Processing custom task | ` +
            `Job ID: ${job.id}`,
          );
          result = await this.processCustomTask(job, parameters);
          break;

        default:
          throw new Error(`Unknown background task type: ${type}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `[BACKGROUND TASKS QUEUE] Job completed | ` +
        `ID: ${job.id} | ` +
        `Type: ${type} | ` +
        `User: ${userId || 'system'} | ` +
        `Worker took: ${processingTime}ms | ` +
        `Result: ${JSON.stringify(result)} | ` +
        `Status: success`,
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error(
        `[BACKGROUND TASKS QUEUE] Job failed | ` +
        `ID: ${job.id} | ` +
        `Type: ${type} | ` +
        `User: ${userId || 'system'} | ` +
        `Worker took: ${processingTime}ms | ` +
        `Attempt: ${job.attemptsMade + 1}/${job.opts.attempts} | ` +
        `Error: ${errorMessage} | ` +
        `Stack: ${errorStack || 'N/A'}`,
      );
      throw error;
    }
  }

  private async generateReport(
    job: Job<BackgroundTaskJobData>,
    userId?: string,
    parameters?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(25);
    
    this.logger.log(`Generating report for user ${userId}`);
    
    await job.updateProgress(50);
    
    await job.updateProgress(75);
    
    await job.updateProgress(100);

    return {
      reportId: `report-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      userId,
    };
  }

  private async cleanupData(
    job: Job<BackgroundTaskJobData>,
    parameters?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(25);
    
    const daysOld = parameters?.daysOld || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await job.updateProgress(50);
    
    this.logger.log(`Cleaning up data older than ${daysOld} days`);

    await job.updateProgress(75);
    
    await job.updateProgress(100);

    return {
      cleanedAt: new Date().toISOString(),
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  private async sendNotification(
    job: Job<BackgroundTaskJobData>,
    userId?: string,
    parameters?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(50);
    
    this.logger.log(`Sending notification to user ${userId}`);
    
    await job.updateProgress(100);

    return {
      notificationId: `notif-${Date.now()}`,
      sentAt: new Date().toISOString(),
      userId,
    };
  }

  private async processAnalytics(
    job: Job<BackgroundTaskJobData>,
    parameters?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(25);
    
    await job.updateProgress(50);
    
    await job.updateProgress(75);
    
    await job.updateProgress(100);

    return {
      analyticsId: `analytics-${Date.now()}`,
      processedAt: new Date().toISOString(),
    };
  }

  private async processCustomTask(
    job: Job<BackgroundTaskJobData>,
    parameters?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(50);
    
    await job.updateProgress(100);

    return {
      taskId: `task-${Date.now()}`,
      completedAt: new Date().toISOString(),
      parameters,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    const processingTime = job.processedOn && job.finishedOn 
      ? job.finishedOn - job.processedOn 
      : 'N/A';
    
    this.logger.log(
      `[BACKGROUND TASKS QUEUE] Worker completed | ` +
      `Job ID: ${job.id} | ` +
      `Type: ${job.data.type} | ` +
      `User: ${job.data.userId || 'system'} | ` +
      `Processing time: ${processingTime}ms | ` +
      `Completed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    const processingTime = job.processedOn && job.finishedOn 
      ? job.finishedOn - job.processedOn 
      : 'N/A';
    
    this.logger.error(
      `[BACKGROUND TASKS QUEUE] Worker failed | ` +
      `Job ID: ${job.id} | ` +
      `Type: ${job.data.type} | ` +
      `User: ${job.data.userId || 'system'} | ` +
      `Attempts made: ${job.attemptsMade}/${job.opts.attempts} | ` +
      `Processing time: ${processingTime}ms | ` +
      `Error: ${error.message} | ` +
      `Failed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(
      `[BACKGROUND TASKS QUEUE] Worker stalled | ` +
      `Job ID: ${jobId} | ` +
      `Time: ${new Date().toISOString()}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `[BACKGROUND TASKS QUEUE] Worker active | ` +
      `Job ID: ${job.id} | ` +
      `Type: ${job.data.type} | ` +
      `User: ${job.data.userId || 'system'} | ` +
      `Started at: ${job.processedOn ? new Date(job.processedOn).toISOString() : 'N/A'}`,
    );
  }
}

