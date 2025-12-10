import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

export interface EmailJobData {
  type: 'otp' | 'device-verification' | 'custom';
  to: string;
  subject?: string;
  html?: string;
  otpCode?: string;
  fullName?: string;
  ipAddress?: string;
}

@Processor('email', {
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000,
  },
})
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const startTime = Date.now();
    const { type, to, subject, html, otpCode, fullName, ipAddress } = job.data;
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
      `[EMAIL QUEUE] Job started | ` +
      `ID: ${job.id} | ` +
      `Type: ${type} | ` +
      `To: ${to} | ` +
      `Attempt: ${job.attemptsMade + 1}/${job.opts.attempts} | ` +
      `Priority: ${job.opts.priority || 'default'} | ` +
      `Options: ${JSON.stringify(jobOptions)}`,
    );

    try {
      switch (type) {
        case 'otp':
          if (!otpCode || !fullName) {
            throw new Error('OTP code and full name are required for OTP emails');
          }
          await this.emailService.sendOtpEmail(to, otpCode, fullName);
          break;

        case 'device-verification':
          if (!otpCode || !fullName || !ipAddress) {
            throw new Error('OTP code, full name, and IP address are required for device verification emails');
          }
          await this.emailService.sendDeviceVerificationEmail(to, otpCode, fullName, ipAddress);
          break;

        case 'custom':
          if (!subject || !html) {
            throw new Error('Subject and HTML are required for custom emails');
          }
          await this.emailService.sendCustomEmail(to, subject, html);
          break;

        default:
          throw new Error(`Unknown email type: ${type}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `[EMAIL QUEUE] Job completed | ` +
        `ID: ${job.id} | ` +
        `Type: ${type} | ` +
        `To: ${to} | ` +
        `Worker took: ${processingTime}ms | ` +
        `Status: success`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error(
        `[EMAIL QUEUE] Job failed | ` +
        `ID: ${job.id} | ` +
        `Type: ${type} | ` +
        `To: ${to} | ` +
        `Worker took: ${processingTime}ms | ` +
        `Attempt: ${job.attemptsMade + 1}/${job.opts.attempts} | ` +
        `Error: ${errorMessage} | ` +
        `Stack: ${errorStack || 'N/A'}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    const processingTime = job.processedOn && job.finishedOn 
      ? job.finishedOn - job.processedOn 
      : 'N/A';
    
    this.logger.log(
      `[EMAIL QUEUE] Worker completed | ` +
      `Job ID: ${job.id} | ` +
      `To: ${job.data.to} | ` +
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
      `[EMAIL QUEUE] Worker failed | ` +
      `Job ID: ${job.id} | ` +
      `To: ${job.data.to} | ` +
      `Attempts made: ${job.attemptsMade}/${job.opts.attempts} | ` +
      `Processing time: ${processingTime}ms | ` +
      `Error: ${error.message} | ` +
      `Failed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(
      `[EMAIL QUEUE] Worker stalled | ` +
      `Job ID: ${jobId} | ` +
      `Time: ${new Date().toISOString()}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `[EMAIL QUEUE] Worker active | ` +
      `Job ID: ${job.id} | ` +
      `To: ${job.data.to} | ` +
      `Started at: ${job.processedOn ? new Date(job.processedOn).toISOString() : 'N/A'}`,
    );
  }
}

