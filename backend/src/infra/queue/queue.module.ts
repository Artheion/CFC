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
    console.log('[QueueModule] 🏗️  QueueModule constructor called');
    this.logger.log('🏗️  QueueModule constructor called');
  }

  onModuleInit() {
    console.log('[QueueModule] 🚀 QueueModule initialized - Redis should be connected');
    this.logger.log('🚀 QueueModule initialized - Redis should be connected');
  }
}
