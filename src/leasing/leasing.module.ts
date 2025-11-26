import { Module } from '@nestjs/common';
import { LeasingService } from './leasing.service';
import { LeasingController } from './leasing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LeasingController],
  providers: [LeasingService],
  exports: [LeasingService],
})
export class LeasingModule {}
