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
import { MaintenanceRequestService } from './maintenance-request.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
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

@Controller('maintenance-request')
@UseGuards(JwtAuthGuard)
export class MaintenanceRequestController {
  constructor(
    private readonly maintenanceRequestService: MaintenanceRequestService,
  ) {}

  @Post()
  create(
    @Body() createMaintenanceRequestDto: CreateMaintenanceRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.maintenanceRequestService.create(
      createMaintenanceRequestDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.maintenanceRequestService.findAll(req.user?.userId);
  }

  @Get('property/:propertyId')
  findByPropertyId(
    @Param('propertyId') propertyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.maintenanceRequestService.findByPropertyId(
      propertyId,
      req.user?.userId,
    );
  }

  @Get('unit/:unitId')
  findByUnitId(
    @Param('unitId') unitId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.maintenanceRequestService.findByUnitId(
      unitId,
      req.user?.userId,
    );
  }

  @Get('single-unit-detail/:singleUnitDetailId')
  findBySingleUnitDetailId(
    @Param('singleUnitDetailId') singleUnitDetailId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.maintenanceRequestService.findBySingleUnitDetailId(
      singleUnitDetailId,
      req.user?.userId,
    );
  }

  @Get('equipment/:equipmentId')
  findByEquipmentId(
    @Param('equipmentId') equipmentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.maintenanceRequestService.findByEquipmentId(
      equipmentId,
      req.user?.userId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.maintenanceRequestService.findOne(id, req.user?.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMaintenanceRequestDto: UpdateMaintenanceRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.maintenanceRequestService.update(
      id,
      updateMaintenanceRequestDto,
      req.user?.userId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.maintenanceRequestService.remove(id, req.user?.userId);
  }
}
