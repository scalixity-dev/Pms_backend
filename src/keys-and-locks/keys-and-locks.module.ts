import { Module } from '@nestjs/common';
import { KeysAndLocksService } from './keys-and-locks.service';
import { KeysAndLocksController } from './keys-and-locks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [KeysAndLocksController],
  providers: [KeysAndLocksService],
})
export class KeysAndLocksModule {}
