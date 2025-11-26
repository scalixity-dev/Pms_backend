import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export enum FileCategory {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export class UploadFileDto {
  @IsEnum(FileCategory, { message: 'File category must be IMAGE, VIDEO, or DOCUMENT' })
  @IsNotEmpty({ message: 'File category is required' })
  category: FileCategory;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UploadImageDto {
  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class DeleteFileDto {
  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  fileUrl: string;
}

