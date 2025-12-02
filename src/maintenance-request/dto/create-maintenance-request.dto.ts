import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MaintenanceRequestType {
  MAINTENANCE = 'MAINTENANCE',
  REPAIR = 'REPAIR',
  INSPECTION = 'INSPECTION',
  OTHER = 'OTHER',
}

export enum MaintenanceCategory {
  APPLIANCES = 'APPLIANCES',
  ELECTRICAL = 'ELECTRICAL',
  EXTERIOR = 'EXTERIOR',
  HOUSEHOLD = 'HOUSEHOLD',
  OUTDOORS = 'OUTDOORS',
  PLUMBING = 'PLUMBING',
}

export enum MaintenancePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum MaintenanceStatus {
  NEW = 'NEW',
  IN_REVIEW = 'IN_REVIEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateMaintenancePhotoDto {
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateMaintenanceMaterialDto {
  @IsString()
  @IsNotEmpty({ message: 'Material name is required' })
  materialName: string;

    @IsNumber({}, { message: 'Quantity must be a number' })
    @IsPositive({ message: 'Quantity must be positive' })
    @IsOptional()
    quantity?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateMaintenanceRequestDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Property ID is required' })
  propertyId: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsUUID()
  @IsOptional()
  singleUnitDetailId?: string;

  @IsEnum(MaintenanceRequestType, {
    message: 'Request type must be MAINTENANCE, REPAIR, INSPECTION, or OTHER',
  })
  @IsOptional()
  requestType?: MaintenanceRequestType;

  @IsBoolean()
  @IsOptional()
  equipmentLinked?: boolean;

  @IsUUID()
  @IsOptional()
  equipmentId?: string;

  @IsEnum(MaintenanceCategory, {
    message:
      'Category must be APPLIANCES, ELECTRICAL, EXTERIOR, HOUSEHOLD, OUTDOORS, or PLUMBING',
  })
  @IsNotEmpty({ message: 'Category is required' })
  category: MaintenanceCategory;

  @IsString()
  @IsNotEmpty({ message: 'Subcategory is required' })
  subcategory: string;

  @IsString()
  @IsOptional()
  issue?: string;

  @IsString()
  @IsOptional()
  subissue?: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsString()
  @IsOptional()
  problemDetails?: string;

  @IsEnum(MaintenancePriority, {
    message: 'Priority must be LOW, MEDIUM, HIGH, or URGENT',
  })
  @IsOptional()
  priority?: MaintenancePriority;

  @IsEnum(MaintenanceStatus, {
    message:
      'Status must be NEW, IN_REVIEW, ASSIGNED, IN_PROGRESS, ON_HOLD, COMPLETED, or CANCELLED',
  })
  @IsOptional()
  status?: MaintenanceStatus;

  @IsString()
  @IsOptional()
  internalNotes?: string;

  @IsString()
  @IsOptional()
  tenantInformation?: string;

  @IsDateString({}, { message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateMaintenancePhotoDto)
  photos?: CreateMaintenancePhotoDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateMaintenanceMaterialDto)
  materials?: CreateMaintenanceMaterialDto[];
}
