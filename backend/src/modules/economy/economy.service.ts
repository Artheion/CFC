import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QueueService } from '@infra/queue/queue.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';

const ECONOMY_TICK_INTERVAL_MS = 60 * 1000;

@Injectable()
export class EconomyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EconomyService.name);
  private tickHandle?: NodeJS.Timeout;

  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    this.scheduleRecurringTick();
  }

  onModuleDestroy() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
    }
  }

  async runRecoveryTick(immediate = false) {
    this.logger.debug(`Queueing recovery tick (immediate: ${immediate})`);
    const jobName = immediate ? 'economy-tick-immediate' : 'economy-tick';
    await this.queueService
      .getQueue(JOB_QUEUE_NAMES.ECONOMY_TICK)
      .add(jobName, { immediate }, { removeOnComplete: true });
  }

  private scheduleRecurringTick() {
    this.tickHandle = setInterval(() => {
      this.runRecoveryTick().catch((error) => this.logger.error('Failed to enqueue economy tick', error.stack));
    }, ECONOMY_TICK_INTERVAL_MS);
  }
}
