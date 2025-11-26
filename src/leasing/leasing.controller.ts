import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { LeasingService } from './leasing.service';
import { CreateLeasingDto } from './dto/create-leasing.dto';
import { UpdateLeasingDto } from './dto/update-leasing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

@Controller('leasing')
@UseGuards(JwtAuthGuard)
export class LeasingController {
  constructor(private readonly leasingService: LeasingService) {}

  @Post()
  create(@Body() createLeasingDto: CreateLeasingDto, @Req() req: AuthenticatedRequest) {
    return this.leasingService.create(createLeasingDto, req.user?.userId);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.leasingService.findAll(req.user?.userId);
  }

  @Get('property/:propertyId')
  findByPropertyId(
    @Param('propertyId') propertyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leasingService.findByPropertyId(propertyId, req.user?.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leasingService.findOne(id, req.user?.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLeasingDto: UpdateLeasingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leasingService.update(id, updateLeasingDto, req.user?.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leasingService.remove(id, req.user?.userId);
  }
}
