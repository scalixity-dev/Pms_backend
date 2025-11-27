import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsUUID,
  IsNumber,
  Min,
  IsInt,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ResidenceType {
  RENT = 'RENT',
  OWN = 'OWN',
}

export class CreateApplicantDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber: string;

  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  @IsNotEmpty({ message: 'Date of birth is required' })
  dateOfBirth: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateOccupantDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  @IsNotEmpty({ message: 'Date of birth is required' })
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty({ message: 'Relationship is required' })
  relationship: string;
}

export class CreatePetDto {
  @IsString()
  @IsNotEmpty({ message: 'Pet type is required' })
  type: string;

  @IsString()
  @IsNotEmpty({ message: 'Pet name is required' })
  name: string;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Weight must be a positive number' })
  @Type(() => Number)
  weight?: number;

  @IsString()
  @IsNotEmpty({ message: 'Breed is required' })
  breed: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;
}

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty({ message: 'Vehicle type is required' })
  type: string;

  @IsString()
  @IsNotEmpty({ message: 'Make is required' })
  make: string;

  @IsString()
  @IsNotEmpty({ message: 'Model is required' })
  model: string;

  @IsInt()
  @IsNotEmpty({ message: 'Year is required' })
  @Type(() => Number)
  year: number;

  @IsString()
  @IsNotEmpty({ message: 'Color is required' })
  color: string;

  @IsString()
  @IsNotEmpty({ message: 'License plate is required' })
  licensePlate: string;

  @IsString()
  @IsNotEmpty({ message: 'Registered in is required' })
  registeredIn: string;
}

export class CreateResidenceHistoryDto {
  @IsEnum(ResidenceType, { message: 'Residence type must be RENT or OWN' })
  @IsNotEmpty({ message: 'Residence type is required' })
  residenceType: ResidenceType;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Monthly rent must be a positive number' })
  @Type(() => Number)
  monthlyRent?: number;

  @IsDateString({}, { message: 'Move in date must be a valid date' })
  @IsNotEmpty({ message: 'Move in date is required' })
  moveInDate: string;

  @IsDateString({}, { message: 'Move out date must be a valid date' })
  @IsOptional()
  moveOutDate?: string;

  @IsString()
  @IsNotEmpty({ message: 'Landlord name is required' })
  landlordName: string;

  @IsEmail({}, { message: 'Landlord email must be a valid email address' })
  @IsNotEmpty({ message: 'Landlord email is required' })
  landlordEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Landlord phone is required' })
  landlordPhone: string;

  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'State is required' })
  state: string;

  @IsString()
  @IsNotEmpty({ message: 'Zip code is required' })
  zipCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  country: string;

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}

export class CreateIncomeDetailDto {
  @IsString()
  @IsNotEmpty({ message: 'Income type is required' })
  incomeType: string;

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  companyName: string;

  @IsString()
  @IsNotEmpty({ message: 'Position title is required' })
  positionTitle: string;

  @IsDateString({}, { message: 'Start date must be a valid date' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Monthly income is required' })
  @Min(0, { message: 'Monthly income must be a positive number' })
  @Type(() => Number)
  monthlyIncome: number;

  @IsString()
  @IsNotEmpty({ message: 'Office address is required' })
  officeAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'Supervisor name is required' })
  supervisorName: string;

  @IsString()
  @IsNotEmpty({ message: 'Supervisor phone is required' })
  supervisorPhone: string;

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}

export class CreateEmergencyContactDto {
  @IsString()
  @IsNotEmpty({ message: 'Contact name is required' })
  contactName: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Relationship is required' })
  relationship: string;

  @IsString()
  @IsOptional()
  details?: string;
}

export class CreateReferenceContactDto {
  @IsString()
  @IsNotEmpty({ message: 'Contact name is required' })
  contactName: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Relationship is required' })
  relationship: string;

  @IsInt()
  @IsNotEmpty({ message: 'Years known is required' })
  @Min(0, { message: 'Years known must be a positive number' })
  @Type(() => Number)
  yearsKnown: number;
}

export class CreateBackgroundQuestionDto {
  @IsBoolean()
  @IsNotEmpty({ message: 'Smoke status is required' })
  smoke: boolean;

  @IsBoolean()
  @IsNotEmpty({ message: 'Military member status is required' })
  militaryMember: boolean;

  @IsBoolean()
  @IsNotEmpty({ message: 'Criminal record status is required' })
  criminalRecord: boolean;

  @IsBoolean()
  @IsNotEmpty({ message: 'Bankruptcy status is required' })
  bankruptcy: boolean;

  @IsBoolean()
  @IsNotEmpty({ message: 'Refused rent status is required' })
  refusedRent: boolean;

  @IsBoolean()
  @IsNotEmpty({ message: 'Evicted status is required' })
  evicted: boolean;
}

export class CreateApplicationDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Leasing ID is required' })
  leasingId: string;

  @IsUUID()
  @IsOptional()
  invitedById?: string;

  @IsEnum(ApplicationStatus, {
    message:
      'Status must be DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, or WITHDRAWN',
  })
  @IsOptional()
  status?: ApplicationStatus;

  @IsDateString({}, { message: 'Move in date must be a valid date' })
  @IsNotEmpty({ message: 'Move in date is required' })
  moveInDate: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateApplicantDto)
  @ArrayMinSize(1, { message: 'At least one applicant is required' })
  applicants: CreateApplicantDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateOccupantDto)
  occupants?: CreateOccupantDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePetDto)
  pets?: CreatePetDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDto)
  vehicles?: CreateVehicleDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateResidenceHistoryDto)
  residenceHistory?: CreateResidenceHistoryDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateIncomeDetailDto)
  incomeDetails?: CreateIncomeDetailDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateEmergencyContactDto)
  emergencyContacts?: CreateEmergencyContactDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateReferenceContactDto)
  referenceContacts?: CreateReferenceContactDto[];

  @ValidateNested()
  @IsOptional()
  @Type(() => CreateBackgroundQuestionDto)
  backgroundQuestions?: CreateBackgroundQuestionDto;
}
