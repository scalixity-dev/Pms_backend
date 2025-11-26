import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { FileCategory } from './dto/upload-file.dto';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-south-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME is required');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
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
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read', // Make file publicly accessible
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

