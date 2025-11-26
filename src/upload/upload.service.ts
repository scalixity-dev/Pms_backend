import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListBucketsCommand,
  GetBucketLocationCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { FileCategory } from './dto/upload-file.dto';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-south-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME is required');
    }

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Initialize service on module startup
   * Check bucket existence, create if needed, and test connection
   */
  async onModuleInit() {
    try {
      await this.ensureBucketExists();
      await this.testConnection();
      this.isInitialized = true;
      this.logger.log(`S3 upload service initialized successfully. Bucket: ${this.bucketName}`);
    } catch (error) {
      this.logger.error('Failed to initialize S3 upload service:', error);
      // Don't throw - allow service to start but log the error
      // Uploads will fail with clear error messages
    }
  }

  /**
   * Get bucket's actual region
   */
  private async getBucketRegion(): Promise<string | null> {
    try {
      // GetBucketLocation requires us-east-1 region for the request
      const usEast1Client = new S3Client({
        region: 'us-east-1',
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
        },
      });

      const command = new GetBucketLocationCommand({
        Bucket: this.bucketName,
      });
      const response = await usEast1Client.send(command);
      
      // AWS returns null/empty string for us-east-1, or the region name
      const location = response.LocationConstraint;
      if (!location) {
        return 'us-east-1';
      }
      if (location === 'EU') {
        return 'eu-west-1';
      }
      return location as string;
    } catch (error: any) {
      this.logger.warn(`Could not determine bucket region: ${error.message}`);
      return null;
    }
  }

  /**
   * Update S3Client with correct region
   */
  private updateS3ClientRegion(correctRegion: string): void {
    this.region = correctRegion;
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    this.logger.log(`Updated S3Client region to: ${this.region}`);
  }

  /**
   * Check if bucket exists and handle region mismatches
   */
  private async bucketExists(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.bucketName,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      // Handle 301 redirect (region mismatch)
      if (error.$metadata?.httpStatusCode === 301) {
        this.logger.warn(
          `Bucket ${this.bucketName} exists but in a different region. Current region: ${this.region}. Attempting to detect correct region...`,
        );
        
        // Try to get the actual bucket region
        const actualRegion = await this.getBucketRegion();
        if (actualRegion) {
          if (actualRegion !== this.region) {
            this.logger.warn(
              `Region mismatch detected! Configured: ${this.region}, Actual: ${actualRegion}. Updating S3Client...`,
            );
            this.updateS3ClientRegion(actualRegion);
            
            // Retry with correct region
            try {
              const retryCommand = new HeadBucketCommand({
                Bucket: this.bucketName,
              });
              await this.s3Client.send(retryCommand);
              this.logger.log(`Successfully connected to bucket in region: ${actualRegion}`);
              return true;
            } catch (retryError: any) {
              throw new InternalServerErrorException(
                `Bucket exists in region ${actualRegion}, but connection failed. Please update AWS_REGION in your .env file to: ${actualRegion}`,
              );
            }
          }
        } else {
          throw new InternalServerErrorException(
            `Bucket exists but region mismatch detected (HTTP 301). Please check your AWS_REGION in .env file. The bucket might be in a different region than ${this.region}.`,
          );
        }
      }

      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      
      // Re-throw other errors (permissions, network, etc.)
      throw error;
    }
  }

  /**
   * Create bucket if it doesn't exist
   */
  private async createBucket(): Promise<void> {
    try {
      this.logger.log(`Creating S3 bucket: ${this.bucketName} in region: ${this.region}`);
      
      // For us-east-1, LocationConstraint should not be specified
      // For other regions, it's required
      const createBucketParams: any = {
        Bucket: this.bucketName,
      };

      if (this.region !== 'us-east-1') {
        createBucketParams.CreateBucketConfiguration = {
          LocationConstraint: this.region as any,
        };
      }

      const command = new CreateBucketCommand(createBucketParams);
      await this.s3Client.send(command);
      this.logger.log(`Successfully created bucket: ${this.bucketName}`);
    } catch (error: any) {
      // Bucket might already exist (race condition) or we don't have permissions
      if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
        this.logger.log(`Bucket ${this.bucketName} already exists`);
        return;
      }
      this.logger.error(`Failed to create bucket ${this.bucketName}:`, error.message);
      throw new InternalServerErrorException(
        `Failed to create S3 bucket. Error: ${error.message}. Please check your AWS credentials and permissions.`,
      );
    }
  }

  /**
   * Ensure bucket exists, create if it doesn't
   */
  private async ensureBucketExists(): Promise<void> {
    const exists = await this.bucketExists();
    if (!exists) {
      this.logger.warn(`Bucket ${this.bucketName} does not exist. Attempting to create...`);
      await this.createBucket();
    } else {
      this.logger.log(`Bucket ${this.bucketName} exists and is accessible`);
    }
  }

  /**
   * Test S3 connection by listing buckets
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Test 1: List buckets (tests credentials and basic connectivity)
      const listCommand = new ListBucketsCommand({});
      const listResponse = await this.s3Client.send(listCommand);
      
      // Test 2: Check if our bucket exists and is accessible
      const bucketExists = await this.bucketExists();
      
      // Test 3: Try to put a small test object (tests write permissions)
      const testKey = `test/connection-test-${Date.now()}.txt`;
      const testCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: Buffer.from('Connection test'),
        ContentType: 'text/plain',
      });
      await this.s3Client.send(testCommand);
      
      // Clean up test file
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: testKey,
        });
        await this.s3Client.send(deleteCommand);
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup test file, but connection test passed');
      }

      const message = `S3 connection successful. Bucket: ${this.bucketName}, Region: ${this.region}, Bucket exists: ${bucketExists}`;
      this.logger.log(message);
      
      return {
        success: true,
        message,
        details: {
          bucketName: this.bucketName,
          region: this.region,
          bucketExists,
          totalBuckets: listResponse.Buckets?.length || 0,
        },
      };
    } catch (error: any) {
      const errorMessage = `S3 connection test failed: ${error.message}`;
      this.logger.error(errorMessage, error.stack);
      
      return {
        success: false,
        message: errorMessage,
        details: {
          error: error.name || 'UnknownError',
          code: error.Code || error.code,
          statusCode: error.$metadata?.httpStatusCode,
        },
      };
    }
  }

  /**
   * Get allowed MIME types for each category
   */
  private getAllowedMimeTypes(category: FileCategory): string[] {
    switch (category) {
      case FileCategory.IMAGE:
        return [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          'image/bmp',
          'image/tiff',
          'image/x-icon',
          'image/vnd.microsoft.icon',
        ];
      case FileCategory.VIDEO:
        return [
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
        ];
      case FileCategory.DOCUMENT:
        return [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
      default:
        return [];
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
      'image/x-icon': 'ico',
      'image/vnd.microsoft.icon': 'ico',
      'video/mp4': 'mp4',
      'video/mpeg': 'mpeg',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    };
    return mimeToExt[mimeType] || 'bin';
  }

  /**
   * Validate file type based on category
   */
  private validateFileType(mimeType: string, category: FileCategory): void {
    const allowedTypes = this.getAllowedMimeTypes(category);
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid file type for ${category}. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }
  }

  /**
   * Generate S3 key (path) for the file
   */
  private generateS3Key(
    category: FileCategory,
    userId: string,
    propertyId: string | undefined,
    originalName: string,
    extension: string,
  ): string {
      const timestamp = Date.now();
      const uniqueId = randomBytes(8).toString('hex');
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
      const fileName = `${timestamp}-${uniqueId}-${sanitizedName}`;

    if (propertyId) {
      return `${category.toLowerCase()}/properties/${propertyId}/${fileName}.${extension}`;
    }
    return `${category.toLowerCase()}/users/${userId}/${fileName}.${extension}`;
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    category: FileCategory,
    userId: string,
    propertyId?: string,
  ): Promise<{ url: string; key: string }> {
    try {
      // Ensure bucket exists before uploading (in case initialization failed)
      if (!this.isInitialized) {
        await this.ensureBucketExists();
        this.isInitialized = true;
      }

      // Validate file type
      this.validateFileType(file.mimetype, category);

      // Get file extension
      const extension = this.getFileExtension(file.mimetype);

      // Generate S3 key
      const key = this.generateS3Key(
        category,
        userId,
        propertyId,
        file.originalname,
        extension,
      );

      // Upload to S3
      // Note: ACL is removed - use bucket policy for public access instead
      // If your bucket has ACLs disabled (default for new buckets), this will cause SignatureDoesNotMatch
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ACL: 'public-read', // Removed - use bucket policy instead
      });

      await this.s3Client.send(command);

      // Generate public URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      return { url, key };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error uploading file to S3:', error);
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length !== 2) {
        throw new BadRequestException('Invalid S3 file URL');
      }

      const key = urlParts[1];

      // Delete from S3
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error deleting file from S3:', error);
      throw new InternalServerErrorException('Failed to delete file from S3');
    }
  }

  /**
   * Generate presigned URL for temporary access (optional, for private files)
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new InternalServerErrorException('Failed to generate presigned URL');
    }
  }
}

