import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ServiceProviderService } from './service-provider.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { AssignToRequestDto } from './dto/assign-to-request.dto';
import { UpdateAssignmentStatusDto } from './dto/update-assignment-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssignmentStatus } from '@prisma/client';

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

@Controller('service-provider')
@UseGuards(JwtAuthGuard)
export class ServiceProviderController {
  constructor(
    private readonly serviceProviderService: ServiceProviderService,
  ) {}

  @Post()
  create(
    @Body() createServiceProviderDto: CreateServiceProviderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.create(createServiceProviderDto);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;
    return this.serviceProviderService.findAll(isActiveBool);
  }

  @Get('category/:category')
  findByCategory(
    @Param('category') category: string,
    @Req() req: AuthenticatedRequest,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;
    return this.serviceProviderService.findByCategory(category, isActiveBool);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateServiceProviderDto: UpdateServiceProviderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.update(id, updateServiceProviderDto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.remove(id);
  }

  // Maintenance Assignment Endpoints

  @Get(':id/assignments')
  getAssignments(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: AssignmentStatus,
  ) {
    return this.serviceProviderService.getAssignments(id, status);
  }

  @Post(':id/assignments/:requestId')
  assignToMaintenanceRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() assignDto: AssignToRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.assignToMaintenanceRequest(
      id,
      requestId,
      assignDto.scheduledDate ? new Date(assignDto.scheduledDate) : undefined,
      assignDto.notes,
      req.user?.userId,
    );
  }

  @Patch(':id/assignments/:assignmentId/status')
  updateAssignmentStatus(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() updateStatusDto: UpdateAssignmentStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.updateAssignmentStatus(
      id,
      assignmentId,
      updateStatusDto.status,
      updateStatusDto.notes,
    );
  }

  @Delete(':id/assignments/:assignmentId')
  removeAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceProviderService.removeAssignment(
      id,
      assignmentId,
      req.user?.userId,
    );
  }
}
