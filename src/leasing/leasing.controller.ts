import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LeasingService } from './leasing.service';
import { CreateLeasingDto } from './dto/create-leasing.dto';
import { UpdateLeasingDto } from './dto/update-leasing.dto';

@Controller('leasing')
export class LeasingController {
  constructor(private readonly leasingService: LeasingService) {}

  @Post()
  create(@Body() createLeasingDto: CreateLeasingDto) {
    return this.leasingService.create(createLeasingDto);
  }

  @Get()
  findAll() {
    return this.leasingService.findAll();
  }

  @Get('property/:propertyId')
  findByPropertyId(@Param('propertyId') propertyId: string) {
    return this.leasingService.findByPropertyId(propertyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leasingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLeasingDto: UpdateLeasingDto) {
    return this.leasingService.update(id, updateLeasingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leasingService.remove(id);
  }
}
