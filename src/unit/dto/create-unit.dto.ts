import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
  IsUrl,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAmenitiesDto } from '../../property/dto/create-property.dto';

export class CreateUnitPhotoDto {
  @IsUrl()
  @IsNotEmpty()
  photoUrl: string;

  @IsOptional()
  isPrimary?: boolean;
}

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty({ message: 'Unit name is required' })
  unitName: string;

  @IsString()
  @IsOptional()
  apartmentType?: string;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Size in square feet must be a positive number' })
  sizeSqft?: number;

  @IsInt()
  @IsOptional()
  @Min(0, { message: 'Number of beds must be a positive number' })
  beds?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Number of baths must be a positive number' })
  baths?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Rent must be a positive number' })
  rent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Deposit must be a positive number' })
  deposit?: number;

  @IsUrl()
  @IsOptional()
  coverPhotoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateAmenitiesDto)
  amenities?: CreateAmenitiesDto;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateUnitPhotoDto)
  photos?: CreateUnitPhotoDto[];
}
