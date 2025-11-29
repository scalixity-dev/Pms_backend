import { Module } from '@nestjs/common';
import { MaintenanceRequestService } from './maintenance-request.service';
import { MaintenanceRequestController } from './maintenance-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MaintenanceRequestController],
  providers: [MaintenanceRequestService],
})
export class MaintenanceRequestModule {}
