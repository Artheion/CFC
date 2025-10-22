import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { QueueService } from '@infra/queue/queue.service';
import { BlockchainService } from '@infra/blockchain/blockchain.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';

interface ReferralPayoutJobData {
  transactionId: string;
}

@Injectable()
export class ReferralPayoutProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralPayoutProcessor.name);
  private worker?: Worker<ReferralPayoutJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker<ReferralPayoutJobData>(
      JOB_QUEUE_NAMES.REFERRAL_PAYOUT,
      async (job) => this.processJob(job.data.transactionId),
      { connection: this.queueService.getConnection() },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Referral payout job ${job?.id} failed: ${err.message}`, err.stack);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async processJob(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        fromUser: {
          include: {
            referredBy: true,
          },
        },
      },
    });

    if (!transaction || !transaction.fromUser) {
      this.logger.warn(`Transaction ${transactionId} not found for referral payout`);
      return;
    }

    // SAFEGUARD 1: Validate transaction amount is reasonable
    const MAX_REFERRAL_SOURCE = 10; // Max 10 BNB per transaction
    if (transaction.amount.greaterThan(MAX_REFERRAL_SOURCE)) {
      this.logger.error(
        `❌ BLOCKED: Suspicious transaction amount ${transaction.amount.toString()} BNB ` +
        `(max ${MAX_REFERRAL_SOURCE} BNB). Transaction: ${transactionId}. ` +
        `Manual review required.`
      );
      return;
    }

    // Skip free spins - they shouldn't generate referral payouts
    const txMetadata = transaction.metadata as any;
    if (txMetadata?.freeSpin === true) {
      this.logger.log(`Skipping referral payout for free spin transaction ${transactionId}`);
      return;
    }

    const user = transaction.fromUser;
    if (!user.referredByCode || !user.referredBy) {
      return;
    }

    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code: user.referredByCode },
    });

    if (!referralCode || referralCode.earningsSharePercent <= 0) {
      return;
    }

    const sharePercent = new Prisma.Decimal(referralCode.earningsSharePercent);
    const shareAmount = transaction.amount.mul(sharePercent).div(100);

    if (shareAmount.lte(0)) {
      return;
    }

    // SAFEGUARD 2: Validate referral payout amount is reasonable
    const MAX_REFERRAL_PAYOUT = 1; // Max 1 BNB referral payout per transaction
    if (shareAmount.greaterThan(MAX_REFERRAL_PAYOUT)) {
      this.logger.error(
        `❌ BLOCKED: Referral payout ${shareAmount.toString()} BNB exceeds limit ` +
        `(max ${MAX_REFERRAL_PAYOUT} BNB). Transaction: ${transactionId}, ` +
        `Amount: ${transaction.amount.toString()}, Share: ${sharePercent.toString()}%. ` +
        `Manual review required.`
      );
      return;
    }

    // SAFEGUARD 3: Check for duplicate referral payouts
    const existingReferralPayout = await this.prisma.transaction.findFirst({
      where: {
        type: TransactionType.REFERRAL,
        metadata: {
          path: ['sourceTransactionId'],
          equals: transactionId,
        },
      },
    });

    if (existingReferralPayout) {
      this.logger.warn(
        `Duplicate referral payout detected for transaction ${transactionId}. ` +
        `Existing payout: ${existingReferralPayout.id}. Skipping.`
      );
      return;
    }

    const metadata = {
      ...(transaction.metadata as Record<string, unknown> | null ?? {}),
      referralCode: referralCode.code,
      referralShare: shareAmount.toString(),
    };

    // Track earnings but don't send automatically - user withdraws manually
    const paymentStatus: TransactionStatus = TransactionStatus.PENDING;
    const paymentSignature: string | undefined = undefined;
    
    this.logger.log(
      `✅ Processing referral payout: ${shareAmount.toString()} BNB ` +
      `(${sharePercent.toString()}% of ${transaction.amount.toString()} BNB) ` +
      `for ${referralCode.ownerWallet} from transaction ${transactionId}`
    );

    await this.prisma.$transaction([
      this.prisma.referralCode.update({
        where: { id: referralCode.id },
        data: {
          totalEarnedBnb: { increment: shareAmount },
        },
      }),
      this.prisma.referralJoin.updateMany({
        where: {
          referralCodeId: referralCode.id,
          joinedUserId: user.id,
        },
        data: {
          earningsPaid: { increment: shareAmount },
        },
      }),
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          metadata,
          status: TransactionStatus.CONFIRMED,
        },
      }),
      this.prisma.transaction.create({
        data: {
          toUserId: referralCode.ownerId,
          fromWallet: 'HOUSE',
          toWallet: referralCode.ownerWallet,
          amount: shareAmount,
          type: TransactionType.REFERRAL,
          status: paymentStatus,
          signature: paymentSignature,
          metadata: {
            sourceTransactionId: transactionId,
            referralCode: referralCode.code,
          },
        },
      }),
    ]);

    this.logger.log(`Referral payout processed for transaction ${transactionId}`);
  }
}
