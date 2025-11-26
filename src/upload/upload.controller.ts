import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { UploadService } from './upload.service';
import { UploadFileDto, DeleteFileDto, FileCategory, UploadImageDto } from './dto/upload-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { FileType } from '@prisma/client';

// Extend Express Request to include user property from JwtAuthGuard
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    fullName: string;
    isEmailVerified: boolean;
    isActive: boolean;
  };
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('file')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    @Body() uploadFileDto: UploadFileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size (10MB for images, 100MB for videos, 50MB for documents)
    const maxSizes: Record<FileCategory, number> = {
      [FileCategory.IMAGE]: 10 * 1024 * 1024, // 10MB
      [FileCategory.VIDEO]: 100 * 1024 * 1024, // 100MB
      [FileCategory.DOCUMENT]: 50 * 1024 * 1024, // 50MB
    };

    if (file.size > maxSizes[uploadFileDto.category]) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size for ${uploadFileDto.category}`,
      );
    }

    // Upload to S3
    const { url, key } = await this.uploadService.uploadFile(
      file,
      uploadFileDto.category,
      userId,
      uploadFileDto.propertyId,
    );

    // Map FileCategory to Prisma FileType enum
    const fileTypeMap: Record<FileCategory, FileType> = {
      [FileCategory.IMAGE]: FileType.IMAGE,
      [FileCategory.VIDEO]: FileType.OTHER, // Video not in enum, use OTHER
      [FileCategory.DOCUMENT]: FileType.PDF, // Default to PDF, can be enhanced
    };

    // If propertyId is provided, save to PropertyAttachment
    if (uploadFileDto.propertyId) {
      // Determine file type from extension
      let fileType: FileType = FileType.OTHER;
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      
      if (uploadFileDto.category === FileCategory.IMAGE) {
        fileType = FileType.IMAGE;
      } else if (uploadFileDto.category === FileCategory.DOCUMENT) {
        switch (extension) {
          case 'pdf':
            fileType = FileType.PDF;
            break;
          case 'doc':
            fileType = FileType.DOC;
            break;
          case 'docx':
            fileType = FileType.DOCX;
            break;
          case 'xls':
            fileType = FileType.XLS;
            break;
          case 'xlsx':
            fileType = FileType.XLSX;
            break;
          default:
            fileType = FileType.OTHER;
        }
      }

      const attachment = await this.prisma.propertyAttachment.create({
        data: {
          propertyId: uploadFileDto.propertyId,
          fileUrl: url,
          fileType: fileType,
          description: uploadFileDto.description || null,
        },
      });

      return {
        message: 'File uploaded successfully',
        url,
        key,
        attachment,
      };
    }

    return {
      message: 'File uploaded successfully',
      url,
      key,
    };
  }

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    @Body() uploadImageDto: UploadImageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size (10MB for images)
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxImageSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of 10MB for images`,
      );
    }

    // Upload as image
    const { url, key } = await this.uploadService.uploadFile(
      file,
      FileCategory.IMAGE,
      userId,
      uploadImageDto.propertyId,
    );

    // If propertyId is provided, save to PropertyPhoto
    if (uploadImageDto.propertyId) {
      const photo = await this.prisma.propertyPhoto.create({
        data: {
          propertyId: uploadImageDto.propertyId,
          photoUrl: url,
          isPrimary: false,
        },
      });

      return {
        message: 'Image uploaded successfully',
        url,
        key,
        photo,
      };
    }

    return {
      message: 'Image uploaded successfully',
      url,
      key,
    };
  }

  @Delete('file')
  @HttpCode(HttpStatus.OK)
  async deleteFile(
    @Body() deleteFileDto: DeleteFileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Look up PropertyAttachment with property relation to verify ownership
    const attachment = await this.prisma.propertyAttachment.findFirst({
      where: { fileUrl: deleteFileDto.fileUrl },
      include: { property: true },
    });

    // Look up PropertyPhoto with property relation to verify ownership
    const photo = await this.prisma.propertyPhoto.findFirst({
      where: { photoUrl: deleteFileDto.fileUrl },
      include: { property: true },
    });

    // Verify ownership: check if the file is associated with a property owned by the user
    if (attachment) {
      if (attachment.property.managerId !== userId) {
        throw new UnauthorizedException('You do not have permission to delete this file');
      }
    } else if (photo) {
      if (photo.property.managerId !== userId) {
        throw new UnauthorizedException('You do not have permission to delete this file');
      }
    } else {
      // File not found in database - deny deletion for security
      throw new UnauthorizedException('File not found or you do not have permission to delete this file');
    }

    // Authorization passed - proceed with deletion
    // Delete from S3
    await this.uploadService.deleteFile(deleteFileDto.fileUrl);

    // Delete from database
    if (attachment) {
      await this.prisma.propertyAttachment.delete({
        where: { id: attachment.id },
      });
    }

    if (photo) {
      await this.prisma.propertyPhoto.delete({
        where: { id: photo.id },
      });
    }

    return {
      message: 'File deleted successfully',
    };
  }

  @Get('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const result = await this.uploadService.testConnection();
    
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  }
}

