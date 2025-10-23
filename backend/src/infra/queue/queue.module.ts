import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);

  constructor(private readonly queueService: QueueService) {
    this.logger.log('🏗️  QueueModule constructor called');
  }

  onModuleInit() {
    this.logger.log('🚀 QueueModule initialized - Redis should be connected');
  }
}
