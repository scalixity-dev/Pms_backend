import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AssignToRequestDto {
  @IsDateString({}, { message: 'Scheduled date must be a valid date' })
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

