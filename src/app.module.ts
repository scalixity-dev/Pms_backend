import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertyModule } from './property/property.module';
import { LeasingModule } from './leasing/leasing.module';
import { UploadModule } from './upload/upload.module';
import { ApplicationModule } from './application/application.module';
import { SecurityModule } from './config/security.module';
import { EquipmentModule } from './equipment/equipment.module';
import { MaintenanceRequestModule } from './maintenance-request/maintenance-request.module';
import { ServiceProviderModule } from './service-provider/service-provider.module';
import { KeysAndLocksModule } from './keys-and-locks/keys-and-locks.module';
import { ListingModule } from './listing/listing.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SecurityModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,
    UsersModule,
    PropertyModule,
    LeasingModule,
    ListingModule,
    UploadModule,
    ApplicationModule,
    EquipmentModule,
    MaintenanceRequestModule,
    ServiceProviderModule,
    KeysAndLocksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
