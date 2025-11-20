import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Plan ID is required' })
  planId: string;

  @IsBoolean()
  @IsOptional()
  isYearly?: boolean;
}

