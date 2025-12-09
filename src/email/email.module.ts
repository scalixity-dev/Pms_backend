import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [ConfigModule, forwardRef(() => QueueModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

