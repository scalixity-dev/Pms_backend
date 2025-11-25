import { PartialType } from '@nestjs/swagger';
import { CreateLeasingDto } from './create-leasing.dto';

export class UpdateLeasingDto extends PartialType(CreateLeasingDto) {}
