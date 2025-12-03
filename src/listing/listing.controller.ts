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
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
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

@Controller('listing')
@UseGuards(JwtAuthGuard)
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post()
  create(@Body() createListingDto: CreateListingDto, @Req() req: AuthenticatedRequest) {
    return this.listingService.create(createListingDto, req.user?.userId);
  }

  @Get('property/:propertyId')
  findByPropertyId(
    @Param('propertyId') propertyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listingService.findByPropertyId(propertyId, req.user?.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.listingService.findOne(id, req.user?.userId);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.listingService.findAll(req.user?.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listingService.update(id, updateListingDto, req.user?.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.listingService.remove(id, req.user?.userId);
  }
}

