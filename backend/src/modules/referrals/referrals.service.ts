import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { QueueService } from '@infra/queue/queue.service';
import { BlockchainService } from '@infra/blockchain/blockchain.service';
import { JOB_QUEUE_NAMES } from '@jobs/index';
import { Prisma, TransactionType, TransactionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async getOrCreateCodeForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { referralCode: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    const walletPrefix = user.walletAddress.slice(2, 6).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `CFC-${walletPrefix}-${randomPart}`;

    return this.prisma.referralCode.create({
      data: {
        code,
        ownerId: user.id,
        ownerWallet: user.walletAddress,
        ownerUsername: user.username,
      },
    });
  }

  async applyCode(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.referredByCode) {
      throw new BadRequestException('Referral code already applied.');
    }

    const referral = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!referral) {
      throw new NotFoundException('Referral code not found.');
    }

    if (referral.ownerId === userId) {
      throw new BadRequestException('Cannot use your own referral code.');
    }

    const existingJoin = await this.prisma.referralJoin.findFirst({
      where: {
        referralCodeId: referral.id,
        joinedUserId: userId,
      },
    });

    if (existingJoin) {
      throw new BadRequestException('Referral code already used by this wallet.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { referredByCode: code },
      }),
      this.prisma.referralCode.update({
        where: { id: referral.id },
        data: {
          totalUses: { increment: 1 },
          joins: {
            create: {
              joinedUserId: userId,
              joinedWallet: user.walletAddress,
            },
          },
        },
      }),
    ]);

    return { success: true };
  }

  async getReferralStats(userId: string) {
    const code = await this.prisma.referralCode.findFirst({
      where: { ownerId: userId },
      include: {
        joins: {
          orderBy: { joinedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!code) {
      return null;
    }

    return code;
  }

  async listCodesForAdmin(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return this.prisma.referralCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        joins: {
          orderBy: { joinedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateReferralSettings(adminId: string, code: string, data: {
    discountPercent?: number;
    earningsSharePercent?: number;
    freeWheelSpins?: number;
  }) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return this.prisma.referralCode.update({
      where: { code },
      data,
    });
  }

  async queueReferralPayout(transactionId: string) {
    await this.queueService
      .getQueue(JOB_QUEUE_NAMES.REFERRAL_PAYOUT)
      .add('referral-payout', { transactionId }, { removeOnComplete: true });
  }

  /**
   * Withdraw referral earnings - SECURE with multiple validation layers
   */
  async withdrawEarnings(userId: string, requestedAmount: number) {
    // ========== SECURITY CHECK 1: User Authentication ==========
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { referralCode: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.referralCode) {
      throw new BadRequestException('No referral code found. You must have referral earnings to withdraw.');
    }

    const referralCode = user.referralCode;

    // ========== SECURITY CHECK 2: Calculate Available Balance ==========
    const totalEarned = new Decimal(referralCode.totalEarnedBnb);
    const totalWithdrawn = new Decimal(referralCode.totalWithdrawnBnb);
    const availableBalance = totalEarned.minus(totalWithdrawn);

    if (availableBalance.lessThanOrEqualTo(0)) {
      throw new BadRequestException('No earnings available to withdraw');
    }

    // ========== SECURITY CHECK 3: Validate Withdrawal Amount ==========
    const MINIMUM_WITHDRAWAL = 0.001; // 0.001 BNB minimum
    const MAXIMUM_WITHDRAWAL = 5.0; // 5 BNB maximum per withdrawal (prevent accidental large withdrawals)
    const requestedDecimal = new Decimal(requestedAmount);

    if (requestedDecimal.lessThan(MINIMUM_WITHDRAWAL)) {
      throw new BadRequestException(`Minimum withdrawal is ${MINIMUM_WITHDRAWAL} BNB`);
    }

    if (requestedDecimal.greaterThan(MAXIMUM_WITHDRAWAL)) {
      throw new BadRequestException(
        `Maximum withdrawal per transaction is ${MAXIMUM_WITHDRAWAL} BNB. ` +
        `Please contact support for larger withdrawals.`
      );
    }

    if (requestedDecimal.greaterThan(availableBalance)) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${availableBalance.toString()} BNB, Requested: ${requestedAmount} BNB`
      );
    }

    // ========== SECURITY CHECK 4: Rate Limiting ==========
    if (referralCode.lastWithdrawalAt) {
      const hoursSinceLastWithdrawal =
        (Date.now() - referralCode.lastWithdrawalAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastWithdrawal < 1) {
        throw new BadRequestException(
          'Please wait at least 1 hour between withdrawals'
        );
      }
    }

    // ========== SECURITY CHECK 5: Verify Blockchain Service ==========
    if (!this.blockchainService.isConfigured()) {
      throw new BadRequestException('Withdrawal system is temporarily unavailable');
    }

    // ========== SECURITY CHECK 6: Check Treasury Balance ==========
    try {
      const treasuryBalance = await this.blockchainService.getTreasuryBalance();
      const treasuryBalanceDecimal = new Decimal(treasuryBalance);
      
      // Keep 0.01 BNB buffer for gas fees
      const minimumTreasuryReserve = new Decimal(0.01);
      const availableTreasury = treasuryBalanceDecimal.minus(minimumTreasuryReserve);

      if (requestedDecimal.greaterThan(availableTreasury)) {
        throw new BadRequestException(
          'Treasury balance insufficient. Please contact support.'
        );
      }
    } catch (error) {
      throw new BadRequestException('Unable to verify treasury balance. Please try again later.');
    }

    // ========== EXECUTE WITHDRAWAL WITH TRANSACTION ==========
    let txHash: string;
    
    try {
      // Send BNB first
      txHash = await this.blockchainService.sendBNB(
        user.walletAddress,
        requestedAmount.toString()
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown blockchain error';
      throw new BadRequestException(`Withdrawal failed: ${errorMessage}`);
    }

    // ========== UPDATE DATABASE ATOMICALLY ==========
    const result = await this.prisma.$transaction(async (tx) => {
      // Update referral code with withdrawn amount
      const updatedCode = await tx.referralCode.update({
        where: { id: referralCode.id },
        data: {
          totalWithdrawnBnb: {
            increment: requestedAmount,
          },
          lastWithdrawalAt: new Date(),
        },
      });

      // Create WITHDRAWAL transaction record
      const transaction = await tx.transaction.create({
        data: {
          fromUserId: user.id,
          fromWallet: user.walletAddress,
          toWallet: user.walletAddress,
          amount: new Decimal(requestedAmount),
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.CONFIRMED,
          signature: txHash,
          metadata: {
            referralCode: referralCode.code,
            previousWithdrawn: totalWithdrawn.toString(),
            newWithdrawn: updatedCode.totalWithdrawnBnb.toString(),
            totalEarned: totalEarned.toString(),
          } as Prisma.JsonObject,
        },
      });

      return { updatedCode, transaction };
    });

    return {
      success: true,
      transactionHash: txHash,
      withdrawnAmount: requestedAmount,
      remainingBalance: availableBalance.minus(requestedDecimal).toNumber(),
      transaction: result.transaction,
    };
  }
}
