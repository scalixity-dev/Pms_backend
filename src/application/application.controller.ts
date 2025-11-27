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
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
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

@Controller('application')
@UseGuards(JwtAuthGuard)
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  create(
    @Body() createApplicationDto: CreateApplicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationService.create(
      createApplicationDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.applicationService.findAll(req.user?.userId);
  }

  @Get('leasing/:leasingId')
  findByLeasingId(
    @Param('leasingId') leasingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationService.findByLeasingId(
      leasingId,
      req.user?.userId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.applicationService.findOne(id, req.user?.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateApplicationDto: UpdateApplicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationService.update(
      id,
      updateApplicationDto,
      req.user?.userId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.applicationService.remove(id, req.user?.userId);
  }
}
