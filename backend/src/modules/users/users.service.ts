import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { EscrowService } from '@infra/escrow/escrow.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referralCode: true,
      },
    });

    if (!user) {
      return null;
    }

    if (!user.referralCode) {
      const walletPrefix = user.walletAddress.slice(2, 6).toUpperCase();
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `CFC-${walletPrefix}-${randomPart}`;

      await this.prisma.referralCode.create({
        data: {
          code,
          ownerId: user.id,
          ownerWallet: user.walletAddress,
          ownerUsername: user.username || undefined,
        },
      });

      return this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          referralCode: true,
        },
      });
    }

    return user;
  }

  async getReferralInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referredBy: true,
        referralCode: {
          include: {
            joins: true
          }
        }
      }
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const totalEarned = user.referralCode?.totalEarnedBnb || 0;
    const totalWithdrawn = user.referralCode?.totalWithdrawnBnb || 0;
    const availableBalance = Number(totalEarned) - Number(totalWithdrawn);
    const lastWithdrawalAt = user.referralCode?.lastWithdrawalAt || null;

    return {
      hasReferralCode: !!user.referredByCode,
      referralCode: user.referredByCode || undefined,
      discountPercent: user.referredBy?.discountPercent || 0,
      hasFreeSpin: !!(user.referredBy && user.referredBy.freeWheelSpins > 0 && !user.hasUsedFreeSpin),
      totalEarnings: totalEarned.toString(),
      ownReferralCode: user.referralCode?.code,
      ownReferralEarnings: availableBalance.toFixed(9), // Available balance (earned - withdrawn)
      totalEarnedFromReferrals: totalEarned.toString(),
      totalWithdrawn: totalWithdrawn.toString(),
      lastWithdrawalAt: lastWithdrawalAt?.toISOString() || null,
    };
  }

  updateProfile(userId: string, data: { username?: string; avatarUrl?: string; hasCompletedOnboarding?: boolean }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const updatePayload: { username?: string | null; avatarUrl?: string | null; hasCompletedOnboarding?: boolean } = {};

      if (data.username !== undefined) {
        const trimmed = data.username.trim();
        if (!trimmed) {
          updatePayload.username = null;
        } else {
          const existing = await tx.user.findFirst({
            where: {
              username: trimmed,
              id: { not: userId },
            },
          });

          if (existing) {
            throw new BadRequestException('Username already taken');
          }

          updatePayload.username = trimmed;
        }
      }

      if (data.avatarUrl !== undefined) {
        const trimmed = data.avatarUrl.trim();
        if (!trimmed) {
          updatePayload.avatarUrl = null;
        } else {
          updatePayload.avatarUrl = trimmed;
        }
      }

      if (data.hasCompletedOnboarding !== undefined) {
        updatePayload.hasCompletedOnboarding = data.hasCompletedOnboarding;
      }

      if (Object.keys(updatePayload).length === 0) {
        return user;
      }

      return tx.user.update({
        where: { id: userId },
        data: updatePayload,
      });
    });
  }

  /**
   * Get claimable CFC amount for user (for display only, actual claiming happens on frontend)
   */
  async getClaimableCfc(userId: string) {
    // ========== SECURITY CHECK 1: User Authentication ==========
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        cocks: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ========== SECURITY CHECK 2: Find Unclaimed Matches ==========
    // Get all completed fights where user participated or bet
    const userCockIds = user.cocks.map((c: any) => c.id);
    const completedFights = await this.prisma.fight.findMany({
      where: {
        status: 'FINISHED',
        OR: [
          { cock1Id: { in: userCockIds } },
          { cock2Id: { in: userCockIds } },
          {
            spectatorBets: {
              some: {
                userId: userId,
                status: 'PENDING', // Not yet claimed
              },
            },
          },
        ],
      },
    });

    // ========== SECURITY CHECK 3: Calculate Available Balance from Contract ==========
    // Query contract for potential payouts
    let totalClaimable = 0;
    const claimableMatches: string[] = [];

    if (completedFights.length > 0) {
      for (const fight of completedFights) {
        try {
          const payout = await this.escrow.calculatePotentialPayout(fight.id, user.walletAddress);
          const payoutAmount = parseFloat(payout);
          
          if (payoutAmount > 0) {
            totalClaimable += payoutAmount;
            claimableMatches.push(fight.id);
          }
        } catch (error) {
          console.error(`Failed to get payout for match ${fight.id}:`, error);
        }
      }
    }

    // Return claimable info (even if 0 - that's a valid state)
    return {
      claimableAmount: totalClaimable,
      matchIds: claimableMatches,
      matchCount: claimableMatches.length,
      minimumClaimable: 100,
      canClaim: totalClaimable >= 100,
    };
  }

  /**
   * Mark payouts as claimed after user claims via frontend
   */
  async markPayoutsClaimed(userId: string, matchIds: string[], transactionHash: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate total claimed amount
    let totalClaimed = 0;
    for (const matchId of matchIds) {
      try {
        const payout = await this.escrow.calculatePotentialPayout(matchId, user.walletAddress);
        totalClaimed += parseFloat(payout);
      } catch (error) {
        console.error(`Failed to calculate claimed amount for match ${matchId}`);
      }
    }

    // Update spectator bets to CLAIMED status
    await this.prisma.spectatorBet.updateMany({
      where: {
        userId: userId,
        fightId: { in: matchIds },
        status: 'PENDING',
      },
      data: {
        status: 'WON',
      },
    });

    // Update user's claim record
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        cfcWithdrawn: new Decimal(Number(user.cfcWithdrawn || 0) + totalClaimed),
        lastCfcWithdrawalAt: new Date(),
      },
    });

    return {
      success: true,
      matchesClaimed: matchIds.length,
      totalClaimed,
      transactionHash,
    };
  }
}
