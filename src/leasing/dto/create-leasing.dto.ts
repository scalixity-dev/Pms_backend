import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEmail,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreateLeasingDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Property ID is required' })
  propertyId: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Monthly rent is required' })
  @Min(0, { message: 'Monthly rent must be a positive number' })
  @Type(() => Number)
  monthlyRent: number;

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

  @IsDateString({}, { message: 'Date available must be a valid date' })
  @IsNotEmpty({ message: 'Date available is required' })
  dateAvailable: string;

  @IsEnum(LeaseDuration, { message: 'Min lease duration is required' })
  @IsNotEmpty({ message: 'Min lease duration is required' })
  minLeaseDuration: LeaseDuration;

  @IsEnum(LeaseDuration, { message: 'Max lease duration is required' })
  @IsNotEmpty({ message: 'Max lease duration is required' })
  maxLeaseDuration: LeaseDuration;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsNotEmpty({ message: 'Pets allowed is required' })
  petsAllowed: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  petCategory?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Pet deposit must be a positive number' })
  @Type(() => Number)
  petDeposit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Pet fee must be a positive number' })
  @Type(() => Number)
  petFee?: number;

  @IsString()
  @IsOptional()
  petDescription?: string;

  @IsBoolean()
  @IsNotEmpty({ message: 'Online rental application is required' })
  onlineRentalApplication: boolean;

  @IsBoolean()
  @IsOptional()
  requireApplicationFee?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Application fee must be a positive number' })
  @Type(() => Number)
  applicationFee?: number;

  @IsString()
  @IsNotEmpty({ message: 'Applicant name is required' })
  applicantName: string;

  @IsString()
  @IsNotEmpty({ message: 'Applicant contact is required' })
  applicantContact: string;

  @IsEmail({}, { message: 'Applicant email must be a valid email address' })
  @IsNotEmpty({ message: 'Applicant email is required' })
  applicantEmail: string;
}
