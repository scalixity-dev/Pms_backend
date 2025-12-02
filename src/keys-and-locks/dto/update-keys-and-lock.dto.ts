import { PartialType } from '@nestjs/swagger';
import { CreateKeysAndLockDto } from './create-keys-and-lock.dto';

export class UpdateKeysAndLockDto extends PartialType(CreateKeysAndLockDto) {}
