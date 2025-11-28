import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsDateString,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EquipmentStatus {
  ACTIVE = 'ACTIVE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  REPLACED = 'REPLACED',
  DISPOSED = 'DISPOSED',
}

export class CreateEquipmentDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Property ID is required' })
  propertyId: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsUUID()
  @IsOptional()
  singleUnitDetailId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @IsString()
  @IsNotEmpty({ message: 'Brand is required' })
  brand: string;

  @IsString()
  @IsNotEmpty({ message: 'Model is required' })
  model: string;

  @IsString()
  @IsNotEmpty({ message: 'Serial number is required' })
  serialNumber: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Price is required' })
  @Min(0, { message: 'Price must be a positive number' })
  @Type(() => Number)
  price: number;

  @IsDateString({}, { message: 'Date of installation must be a valid date' })
  @IsNotEmpty({ message: 'Date of installation is required' })
  dateOfInstallation: string;

  @IsString()
  @IsOptional()
  equipmentDetails?: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Photo URL must be a valid URL' })
  photoUrl?: string;

  @IsEnum(EquipmentStatus, {
    message: 'Status must be ACTIVE, UNDER_MAINTENANCE, REPLACED, or DISPOSED',
  })
  @IsOptional()
  status?: EquipmentStatus;
}
