import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsUrl,
} from 'class-validator';
import { KeyType, KeyStatus } from '@prisma/client';

export class CreateKeysAndLockDto {
  @IsUUID()
  @IsNotEmpty()
  propertyId: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsUUID()
  @IsOptional()
  singleUnitDetailId?: string;

  @IsString()
  @IsNotEmpty()
  keyName: string;

  @IsEnum(KeyType)
  @IsNotEmpty()
  keyType: KeyType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  keyPhotoUrl?: string;

  @IsEnum(KeyStatus)
  @IsOptional()
  status?: KeyStatus;

  @IsString()
  @IsOptional()
  issuedTo?: string;

  @IsDateString()
  @IsOptional()
  issuedDate?: string;

  @IsDateString()
  @IsOptional()
  returnedDate?: string;
}
