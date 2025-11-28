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
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
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

@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  create(
    @Body() createEquipmentDto: CreateEquipmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.equipmentService.create(
      createEquipmentDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.equipmentService.findAll(req.user?.userId);
  }

  @Get('property/:propertyId')
  findByPropertyId(
    @Param('propertyId') propertyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.equipmentService.findByPropertyId(
      propertyId,
      req.user?.userId,
    );
  }

  @Get('unit/:unitId')
  findByUnitId(@Param('unitId') unitId: string, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.findByUnitId(unitId, req.user?.userId);
  }

  @Get('single-unit-detail/:singleUnitDetailId')
  findBySingleUnitDetailId(
    @Param('singleUnitDetailId') singleUnitDetailId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.equipmentService.findBySingleUnitDetailId(
      singleUnitDetailId,
      req.user?.userId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.findOne(id, req.user?.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.equipmentService.update(
      id,
      updateEquipmentDto,
      req.user?.userId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.remove(id, req.user?.userId);
  }
}
