import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssignmentStatus } from '@prisma/client';

export class UpdateAssignmentStatusDto {
  @IsEnum(AssignmentStatus, {
    message:
      'Status must be ASSIGNED, VENDOR_NOTIFIED, IN_PROGRESS, COMPLETED, or CANCELLED',
  })
  status: AssignmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

