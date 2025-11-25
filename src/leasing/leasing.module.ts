import { Module } from '@nestjs/common';
import { LeasingService } from './leasing.service';
import { LeasingController } from './leasing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LeasingController],
  providers: [LeasingService],
  exports: [LeasingService],
})
export class LeasingModule {}
