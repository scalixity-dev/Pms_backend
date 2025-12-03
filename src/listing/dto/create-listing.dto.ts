import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ListingType {
  ENTIRE_PROPERTY = 'ENTIRE_PROPERTY',
  UNIT = 'UNIT',
}

export enum ListingStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
  REMOVED = 'REMOVED',
}

export enum OccupancyStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  PARTIALLY_OCCUPIED = 'PARTIALLY_OCCUPIED',
}

export enum ListingVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  UNLISTED = 'UNLISTED',
}

export enum LeaseDuration {
  ONE_MONTH = 'ONE_MONTH',
  TWO_MONTHS = 'TWO_MONTHS',
  THREE_MONTHS = 'THREE_MONTHS',
  FOUR_MONTHS = 'FOUR_MONTHS',
  FIVE_MONTHS = 'FIVE_MONTHS',
  SIX_MONTHS = 'SIX_MONTHS',
  SEVEN_MONTHS = 'SEVEN_MONTHS',
  EIGHT_MONTHS = 'EIGHT_MONTHS',
  NINE_MONTHS = 'NINE_MONTHS',
  TEN_MONTHS = 'TEN_MONTHS',
  ELEVEN_MONTHS = 'ELEVEN_MONTHS',
  TWELVE_MONTHS = 'TWELVE_MONTHS',
  THIRTEEN_MONTHS = 'THIRTEEN_MONTHS',
  FOURTEEN_MONTHS = 'FOURTEEN_MONTHS',
  FIFTEEN_MONTHS = 'FIFTEEN_MONTHS',
  SIXTEEN_MONTHS = 'SIXTEEN_MONTHS',
  SEVENTEEN_MONTHS = 'SEVENTEEN_MONTHS',
  EIGHTEEN_MONTHS = 'EIGHTEEN_MONTHS',
  NINETEEN_MONTHS = 'NINETEEN_MONTHS',
  TWENTY_MONTHS = 'TWENTY_MONTHS',
  TWENTY_ONE_MONTHS = 'TWENTY_ONE_MONTHS',
  TWENTY_TWO_MONTHS = 'TWENTY_TWO_MONTHS',
  TWENTY_THREE_MONTHS = 'TWENTY_THREE_MONTHS',
  TWENTY_FOUR_MONTHS = 'TWENTY_FOUR_MONTHS',
  THIRTY_SIX_PLUS_MONTHS = 'THIRTY_SIX_PLUS_MONTHS',
  CONTACT_FOR_DETAILS = 'CONTACT_FOR_DETAILS',
}

export class CreateListingDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Property ID is required' })
  propertyId: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsEnum(ListingType)
  @IsOptional()
  listingType?: ListingType;

  @IsEnum(ListingStatus)
  @IsOptional()
  listingStatus?: ListingStatus;

  @IsEnum(OccupancyStatus)
  @IsOptional()
  occupancyStatus?: OccupancyStatus;

  @IsEnum(ListingVisibility)
  @IsOptional()
  visibility?: ListingVisibility;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Listing price must be a positive number' })
  @Type(() => Number)
  listingPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Monthly rent must be a positive number' })
  @Type(() => Number)
  monthlyRent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Security deposit must be a positive number' })
  @Type(() => Number)
  securityDeposit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Amount refundable must be a positive number' })
  @Type(() => Number)
  amountRefundable?: number;

  @IsEnum(LeaseDuration)
  @IsOptional()
  minLeaseDuration?: LeaseDuration;

  @IsEnum(LeaseDuration)
  @IsOptional()
  maxLeaseDuration?: LeaseDuration;

  @IsDateString({}, { message: 'Available from must be a valid date' })
  @IsOptional()
  availableFrom?: string;

  @IsDateString({}, { message: 'Expires at must be a valid date' })
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  petsAllowed?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  petCategory?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Application fee must be a positive number' })
  @Type(() => Number)
  applicationFee?: number;

  @IsBoolean()
  @IsOptional()
  onlineApplicationAvailable?: boolean;

  @IsString()
  @IsOptional()
  externalListingUrl?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

