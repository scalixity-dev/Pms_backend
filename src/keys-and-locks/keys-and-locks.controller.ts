import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { KeysAndLocksService } from './keys-and-locks.service';
import { CreateKeysAndLockDto } from './dto/create-keys-and-lock.dto';
import { UpdateKeysAndLockDto } from './dto/update-keys-and-lock.dto';
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

@Controller('keys-and-locks')
@UseGuards(JwtAuthGuard)
export class KeysAndLocksController {
  constructor(private readonly keysAndLocksService: KeysAndLocksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createKeysAndLockDto: CreateKeysAndLockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.create(createKeysAndLockDto, userId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.findAll(userId);
  }

  @Get('property/:propertyId')
  @HttpCode(HttpStatus.OK)
  async findByPropertyId(
    @Param('propertyId') propertyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.findByPropertyId(propertyId, userId);
  }

  @Get('unit/:unitId')
  @HttpCode(HttpStatus.OK)
  async findByUnitId(
    @Param('unitId') unitId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.findByUnitId(unitId, userId);
  }

  @Get('single-unit-detail/:singleUnitDetailId')
  @HttpCode(HttpStatus.OK)
  async findBySingleUnitDetailId(
    @Param('singleUnitDetailId') singleUnitDetailId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.findBySingleUnitDetailId(
      singleUnitDetailId,
      userId,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateKeysAndLockDto: UpdateKeysAndLockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.update(id, updateKeysAndLockDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.keysAndLocksService.remove(id, userId);
  }
}
