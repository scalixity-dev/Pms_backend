import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitDto } from './create-unit.dto';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateUnitPhotoDto } from './create-unit.dto';

export class UpdateUnitDto extends PartialType(CreateUnitDto) {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateUnitPhotoDto)
  photos?: CreateUnitPhotoDto[];
}
