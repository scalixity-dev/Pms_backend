import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PropertyType {
  SINGLE = 'SINGLE',
  MULTI = 'MULTI',
}

export enum PropertyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ParkingType {
  NONE = 'NONE',
  STREET = 'STREET',
  GARAGE = 'GARAGE',
  DRIVEWAY = 'DRIVEWAY',
  ASSIGNED = 'ASSIGNED',
}

export enum LaundryType {
  NONE = 'NONE',
  IN_UNIT = 'IN_UNIT',
  ON_SITE = 'ON_SITE',
  HOOKUPS = 'HOOKUPS',
}

export enum AirConditioningType {
  NONE = 'NONE',
  CENTRAL = 'CENTRAL',
  WINDOW = 'WINDOW',
  PORTABLE = 'PORTABLE',
}

export enum FileType {
  PDF = 'PDF',
  DOC = 'DOC',
  DOCX = 'DOCX',
  XLS = 'XLS',
  XLSX = 'XLSX',
  IMAGE = 'IMAGE',
  OTHER = 'OTHER',
}

export class CreateAmenitiesDto {
  @IsEnum(ParkingType, { message: 'Parking type is required' })
  @IsNotEmpty({ message: 'Parking type is required' })
  parking: ParkingType;

  @IsEnum(LaundryType, { message: 'Laundry type is required' })
  @IsNotEmpty({ message: 'Laundry type is required' })
  laundry: LaundryType;

  @IsEnum(AirConditioningType, { message: 'Air conditioning type is required' })
  @IsNotEmpty({ message: 'Air conditioning type is required' })
  airConditioning: AirConditioningType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  propertyFeatures?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  propertyAmenities?: string[];
}

export class CreatePropertyPhotoDto {
  @IsString()
  @IsNotEmpty({ message: 'Photo URL is required' })
  @IsUrl({}, { message: 'Photo URL must be a valid URL' })
  photoUrl: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreatePropertyAttachmentDto {
  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  @IsUrl({}, { message: 'File URL must be a valid URL' })
  fileUrl: string;

  @IsEnum(FileType, { message: 'File type is required' })
  @IsNotEmpty({ message: 'File type is required' })
  fileType: FileType;

  @IsString()
  @IsOptional()
  description?: string;
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

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateAmenitiesDto)
  amenities?: CreateAmenitiesDto;
}

export class CreateSingleUnitDetailDto {
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
  @Min(0, { message: 'Market rent must be a positive number' })
  marketRent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Deposit must be a positive number' })
  deposit?: number;

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateAmenitiesDto)
  amenities?: CreateAmenitiesDto;
}

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  streetAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'State/Region is required' })
  stateRegion: string;

  @IsString()
  @IsNotEmpty({ message: 'Zip code is required' })
  zipCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  country: string;
}

export class CreatePropertyDto {
  // managerId is now extracted from authenticated user, not from request body
  @IsString()
  @IsOptional()
  managerId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Property name is required' })
  propertyName: string;

  @IsInt()
  @IsOptional()
  @Min(0, { message: 'Year built must be a positive number' })
  yearBuilt?: number;

  @IsString()
  @IsOptional()
  mlsNumber?: string;

  @IsEnum(PropertyType, { message: 'Property type must be SINGLE or MULTI' })
  @IsNotEmpty({ message: 'Property type is required' })
  propertyType: PropertyType;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Size in square feet must be a positive number' })
  sizeSqft?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Market rent must be a positive number' })
  marketRent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Deposit amount must be a positive number' })
  depositAmount?: number;

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateAddressDto)
  address?: CreateAddressDto;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PropertyStatus, {
    message: 'Status must be ACTIVE, INACTIVE, or ARCHIVED',
  })
  @IsOptional()
  status?: PropertyStatus;

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateAmenitiesDto)
  amenities?: CreateAmenitiesDto;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePropertyPhotoDto)
  photos?: CreatePropertyPhotoDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePropertyAttachmentDto)
  attachments?: CreatePropertyAttachmentDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateUnitDto)
  units?: CreateUnitDto[];

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateSingleUnitDetailDto)
  singleUnitDetails?: CreateSingleUnitDetailDto;
}