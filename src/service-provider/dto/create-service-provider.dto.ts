import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsEmail,
} from 'class-validator';

export class CreateServiceProviderDto {
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Photo URL must be a valid URL' })
  photoUrl?: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  companyName: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Company website must be a valid URL' })
  companyWebsite?: string;

  @IsString()
  @IsOptional()
  faxNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @IsString()
  @IsOptional()
  subcategory?: string;

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
