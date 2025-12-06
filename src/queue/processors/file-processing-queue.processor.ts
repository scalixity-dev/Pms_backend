import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PropertyService } from '../../property/property.service';
import { CreatePropertyDto } from '../../property/dto/create-property.dto';

export interface FileProcessingJobData {
  type: 'excel-import' | 'file-upload' | 'image-processing';
  userId: string;
  fileBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  propertyData?: CreatePropertyDto[];
  metadata?: Record<string, any>;
}

@Processor('file-processing', {
  concurrency: 2,
  limiter: {
    max: 10,
    duration: 60000,
  },
})
export class FileProcessingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(FileProcessingQueueProcessor.name);
  private propertyService: PropertyService | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  private async getPropertyService(): Promise<PropertyService> {
    if (!this.propertyService) {
      this.propertyService = await this.moduleRef.get(PropertyService, { strict: false });
    }
    if (!this.propertyService) {
      throw new Error('PropertyService not found in module context');
    }
    return this.propertyService;
  }

  async process(job: Job<FileProcessingJobData>): Promise<any> {
    const startTime = Date.now();
    const { type, userId, fileBuffer, fileName, mimeType, propertyData, metadata } = job.data;
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
      `[FILE PROCESSING QUEUE] Job started | ` +
      `ID: ${job.id} | ` +
      `Type: ${type} | ` +
      `User: ${userId} | ` +
      `File: ${fileName || 'N/A'} | ` +
      `File size: ${fileBuffer ? `${(fileBuffer.length / 1024).toFixed(2)} KB` : 'N/A'} | ` +
      `Attempt: ${job.attemptsMade + 1}/${job.opts.attempts} | ` +
      `Priority: ${job.opts.priority || 'default'} | ` +
      `Options: ${JSON.stringify(jobOptions)}`,
    );

    try {
      let result: any;
      
      switch (type) {
        case 'excel-import':
          if (!propertyData || !userId) {
            throw new Error('Property data and user ID are required for Excel import');
          }
          this.logger.log(
            `[FILE PROCESSING QUEUE] Processing Excel import | ` +
            `Job ID: ${job.id} | ` +
            `Properties count: ${propertyData.length}`,
          );
          result = await this.processExcelImport(job, userId, propertyData);
          break;

        case 'file-upload':
          if (!fileBuffer || !fileName || !mimeType) {
            throw new Error('File buffer, name, and MIME type are required for file upload');
          }
          this.logger.log(
            `[FILE PROCESSING QUEUE] Processing file upload | ` +
            `Job ID: ${job.id} | ` +
            `File: ${fileName} | ` +
            `MIME type: ${mimeType}`,
          );
          result = await this.processFileUpload(job, userId, fileBuffer, fileName, mimeType, metadata);
          break;

        case 'image-processing':
          if (!fileBuffer || !fileName) {
            throw new Error('File buffer and name are required for image processing');
          }
          this.logger.log(
            `[FILE PROCESSING QUEUE] Processing image | ` +
            `Job ID: ${job.id} | ` +
            `File: ${fileName}`,
          );
          result = await this.processImage(job, userId, fileBuffer, fileName, metadata);
          break;

        default:
          throw new Error(`Unknown file processing type: ${type}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `[FILE PROCESSING QUEUE] Job completed | ` +
        `ID: ${job.id} | ` +
        `Type: ${type} | ` +
        `User: ${userId} | ` +
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
        `[FILE PROCESSING QUEUE] Job failed | ` +
        `ID: ${job.id} | ` +
        `Type: ${type} | ` +
        `User: ${userId} | ` +
        `Worker took: ${processingTime}ms | ` +
        `Attempt: ${job.attemptsMade + 1}/${job.opts.attempts} | ` +
        `Error: ${errorMessage} | ` +
        `Stack: ${errorStack || 'N/A'}`,
      );
      throw error;
    }
  }

  private async processExcelImport(
    job: Job<FileProcessingJobData>,
    userId: string,
    propertyData: CreatePropertyDto[],
  ): Promise<{ successful: number; failed: number; errors: Array<{ row: number; error: string }> }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    const propertyService = await this.getPropertyService();
    
    for (let i = 0; i < propertyData.length; i++) {
      try {
        await propertyService.create(propertyData[i], userId);
        results.successful++;
        
        const progress = Math.round(((i + 1) / propertyData.length) * 100);
        await job.updateProgress(progress);
        this.logger.debug(
          `[FILE PROCESSING QUEUE] Excel import progress | ` +
          `Job ID: ${job.id} | ` +
          `Progress: ${progress}% | ` +
          `Processed: ${i + 1}/${propertyData.length} | ` +
          `Successful: ${results.successful} | ` +
          `Failed: ${results.failed}`,
        );
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          row: i + 2,
          error: errorMessage,
        });
        this.logger.warn(`Failed to import property at row ${i + 2}: ${errorMessage}`);
      }
    }

    this.logger.log(
      `Excel import job ${job.id} completed | Successful: ${results.successful} | Failed: ${results.failed}`,
    );

    return results;
  }

  private async processFileUpload(
    job: Job<FileProcessingJobData>,
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(50);
    
    this.logger.log(`File upload processing for ${fileName} completed`);
    
    return {
      fileName,
      mimeType,
      size: fileBuffer.length,
      processed: true,
    };
  }

  private async processImage(
    job: Job<FileProcessingJobData>,
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    metadata?: Record<string, any>,
  ): Promise<any> {
    await job.updateProgress(50);
    
    this.logger.log(`Image processing for ${fileName} completed`);
    
    return {
      fileName,
      size: fileBuffer.length,
      processed: true,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    const processingTime = job.processedOn && job.finishedOn 
      ? job.finishedOn - job.processedOn 
      : 'N/A';
    
    this.logger.log(
      `[FILE PROCESSING QUEUE] Worker completed | ` +
      `Job ID: ${job.id} | ` +
      `Type: ${job.data.type} | ` +
      `User: ${job.data.userId} | ` +
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
      `[FILE PROCESSING QUEUE] Worker failed | ` +
      `Job ID: ${job.id} | ` +
      `Type: ${job.data.type} | ` +
      `User: ${job.data.userId} | ` +
      `Attempts made: ${job.attemptsMade}/${job.opts.attempts} | ` +
      `Processing time: ${processingTime}ms | ` +
      `Error: ${error.message} | ` +
      `Failed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(
      `[FILE PROCESSING QUEUE] Worker stalled | ` +
      `Job ID: ${jobId} | ` +
      `Time: ${new Date().toISOString()}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `[FILE PROCESSING QUEUE] Worker active | ` +
      `Job ID: ${job.id} | ` +
      `Type: ${job.data.type} | ` +
      `User: ${job.data.userId} | ` +
      `Started at: ${job.processedOn ? new Date(job.processedOn).toISOString() : 'N/A'}`,
    );
  }
}

