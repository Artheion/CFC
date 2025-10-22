import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { PrismaService } from '@infra/prisma/prisma.service';
import { QueueService } from '@infra/queue/queue.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';
import { Cock } from '@prisma/client';
import { computePassiveRecovery } from '@common/utils/cock-recovery';

@Injectable()
export class EconomyProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EconomyProcessor.name);
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      JOB_QUEUE_NAMES.ECONOMY_TICK,
      async () => this.processTick(),
      { connection: this.queueService.getConnection() },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Economy job ${job?.id} failed: ${err.message}`, err.stack);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async processTick() {
    const updatedCount = await this.applyRecoveryToCocks();
    this.logger.debug(`Economy tick applied to ${updatedCount} cocks`);
  }

  private async applyRecoveryToCocks(batchSize = 50) {
    let updated = 0;
    let cursor: string | undefined;
    const threshold = new Date(Date.now() - 5 * 60 * 1000);

    while (true) {
      const cocks = await this.prisma.cock.findMany({
        take: batchSize,
        orderBy: { id: 'asc' },
        where: {
          OR: [
            { lastRecoveryAt: null },
            { lastRecoveryAt: { lt: threshold } },
          ],
        },
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
      });

      if (cocks.length === 0) {
        break;
      }

      cursor = cocks[cocks.length - 1].id;

      const updates = cocks
        .map((cock) => ({ cock, recovery: computePassiveRecovery(cock) }))
        .filter(({ recovery }) => recovery.needsUpdate);

      if (updates.length > 0) {
        const timestamp = new Date();
        await this.prisma.$transaction(
          updates.map(({ cock, recovery }) =>
            this.prisma.cock.update({
              where: { id: cock.id },
              data: {
                health: recovery.nextHealth,
                energy: recovery.nextEnergy,
                lastRecoveryAt: timestamp,
                healthUpdatedAt: timestamp,
                energyUpdatedAt: timestamp,
              },
            }),
          ),
        );
        updated += updates.length;
      }

      if (cocks.length < batchSize) {
        break;
      }
    }

    return updated;
  }
}
