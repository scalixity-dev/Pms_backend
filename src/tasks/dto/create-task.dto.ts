import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { TaskStatus, TaskFrequency } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsEnum(TaskStatus, {
    message: 'Status must be OPEN or RESOLVED',
  })
  @IsOptional()
  status?: TaskStatus;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString({}, { message: 'Date must be a valid date' })
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @IsBoolean()
  @IsOptional()
  recurring?: boolean;

  @IsEnum(TaskFrequency, {
    message:
      'Frequency must be DAILY, WEEKLY, EVERY_TWO_WEEKS, MONTHLY, QUARTERLY, EVERY_SIX_MONTHS, or YEARLY',
  })
  @IsOptional()
  frequency?: TaskFrequency;

  @IsDateString({}, { message: 'End date must be a valid date' })
  @IsOptional()
  endDate?: string;
}
