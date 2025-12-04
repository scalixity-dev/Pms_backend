import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Express } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { parsePropertyExcelBuffer } from './utils/propertyExcelImporter';

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

@Controller('property')
@UseGuards(JwtAuthGuard)
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.propertyService.create(createPropertyDto, userId);
  }

  @Post('import-excel')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!file || !file.buffer) {
      throw new BadRequestException('Excel file is required');
    }

    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File must be an Excel file (.xls or .xlsx)');
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size must not exceed 10MB');
    }

    const payloads = parsePropertyExcelBuffer(file.buffer);

    const results = {
      total: payloads.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (let i = 0; i < payloads.length; i += 1) {
      const rowNumber = i + 2; // +1 for header row, +1 for 1-based index
      const rawPayload = payloads[i];

      try {
        const dto = plainToInstance(CreatePropertyDto, rawPayload);
        const validationErrors = await validate(dto);

        if (validationErrors.length > 0) {
          const messages: string[] = [];

          for (const err of validationErrors) {
            if (err.constraints) {
              messages.push(...Object.values(err.constraints));
            }
          }

          const message =
            messages.join('; ') || 'Validation failed for this row';

          results.failed += 1;
          results.errors.push({
            row: rowNumber,
            error: message,
          });
          continue;
        }

        await this.propertyService.create(dto, userId);
        results.successful += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';

        results.failed += 1;
        results.errors.push({
          row: rowNumber,
          error: `Row ${rowNumber}: ${message}`,
        });
      }
    }

    return results;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('includeListings') includeListings?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Parse query parameter - only include listings if explicitly requested
    const shouldIncludeListings = includeListings === 'true';
    // Return only properties belonging to the authenticated user
    return this.propertyService.findAll(userId, shouldIncludeListings);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.propertyService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.propertyService.update(id, updatePropertyDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.propertyService.remove(id, userId);
  }
}
