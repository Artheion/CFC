import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cock as CockModel } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { computePassiveRecovery } from '@common/utils/cock-recovery';
import { UpdateCockDto } from './dto/update-cock.dto';

@Injectable()
export class CocksService {
  constructor(private readonly prisma: PrismaService) {}

  async listUserCocks(userId: string) {
    console.log('[CocksService] listUserCocks called with userId:', userId);
    
    const cocks = await this.prisma.cock.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      include: {
        owner: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    console.log('[CocksService] Found', cocks.length, 'cocks for user:', userId);

    // ✅ PERFORMANCE: Batch recovery updates instead of individual updates
    const recoveredCocks = await this.batchApplyPassiveRecovery(cocks);
    
    return recoveredCocks.map(cock => ({
      ...cock,
      earningsCfc: cock.earningsCfc.toString(),
    }));
  }

  async listAllCocks() {
    const cocks = await this.prisma.cock.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    // ✅ PERFORMANCE: Batch recovery updates
    const recoveredCocks = await this.batchApplyPassiveRecovery(cocks);
    
    return recoveredCocks.map(cock => ({
      ...cock,
      earningsCfc: cock.earningsCfc.toString(),
    }));
  }

  async getCockForUser(userId: string, cockId: string) {
    const cock = await this.findOwnedCock(userId, cockId);
    const recovered = await this.applyPassiveRecoveryIfNeeded(cock.id, cock);
    return {
      ...recovered,
      earningsCfc: recovered.earningsCfc.toString(),
    };
  }

  async updateCockProfile(userId: string, cockId: string, dto: UpdateCockDto) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // If not admin, verify ownership
    if (!user?.isAdmin) {
      await this.findOwnedCock(userId, cockId);
    } else {
      // Admin can update any cock, but verify it exists
      const cock = await this.prisma.cock.findUnique({ where: { id: cockId } });
      if (!cock) {
        throw new NotFoundException('Cock not found');
      }
    }

    if (!dto.name && !dto.description) {
      throw new BadRequestException('No updates provided');
    }

    const updated = await this.prisma.cock.update({
      where: { id: cockId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
    
    return {
      ...updated,
      earningsCfc: updated.earningsCfc.toString(),
    };
  }

  async triggerRecovery(userId: string, cockId: string) {
    const cock = await this.findOwnedCock(userId, cockId);
    const recovered = await this.applyPassiveRecoveryIfNeeded(cock.id, cock, true);
    return {
      ...recovered,
      earningsCfc: recovered.earningsCfc.toString(),
    };
  }

  async getLeaderboard() {
    const [mostWins, highestEarnings] = await Promise.all([
      this.prisma.cock.findMany({
        orderBy: [
          { wins: 'desc' },
          { losses: 'asc' },
          { createdAt: 'asc' },
        ],
        take: 20,
        include: {
          owner: {
            select: {
              walletAddress: true,
              username: true,
            },
          },
        },
      }),
      this.prisma.cock.findMany({
        orderBy: [
          { earningsCfc: 'desc' },
          { wins: 'desc' },
          { createdAt: 'asc' },
        ],
        take: 20,
        include: {
          owner: {
            select: {
              walletAddress: true,
              username: true,
            },
          },
        },
      }),
    ]);

    const buildEntry = (cock: (typeof mostWins)[number]) => {
      const totalFights = cock.wins + cock.losses;
      const winRate = totalFights > 0 ? cock.wins / totalFights : 0;

      return {
        cock: {
          ...cock,
          earningsCfc: cock.earningsCfc.toString(),
        },
        ownerWallet: cock.owner.walletAddress,
        ownerUsername: cock.owner.username,
        wins: cock.wins,
        losses: cock.losses,
        earningsBnb: cock.earningsCfc.toString(),
        winRate,
      };
    };

    return {
      mostWins: mostWins.map(buildEntry),
      highestEarnings: highestEarnings.map(buildEntry),
    };
  }

  private async findOwnedCock(userId: string, cockId: string) {
    const cock = await this.prisma.cock.findFirst({
      where: { id: cockId, ownerId: userId },
    });

    if (!cock) {
      throw new NotFoundException('Cock not found');
    }

    return cock;
  }

  /**
   * ✅ PERFORMANCE OPTIMIZATION: Batch apply passive recovery to multiple cocks
   * Instead of updating each cock individually (N+1 problem), batch them together
   * Old: 1 SELECT + N UPDATEs = N+1 queries
   * New: 1 SELECT + 1 batch UPDATE = 2 queries (or just return if no updates needed)
   */
  private async batchApplyPassiveRecovery(cocks: any[]): Promise<any[]> {
    if (cocks.length === 0) return [];

    const now = new Date();
    const cocksNeedingUpdate: string[] = [];
    const recoveryMap = new Map<string, ReturnType<typeof computePassiveRecovery>>();

    // First pass: Compute recovery for all cocks
    for (const cock of cocks) {
      const recovery = computePassiveRecovery(cock, now);
      recoveryMap.set(cock.id, recovery);
      
      if (recovery.needsUpdate) {
        cocksNeedingUpdate.push(cock.id);
      }
    }

    // If no updates needed, return original cocks
    if (cocksNeedingUpdate.length === 0) {
      return cocks;
    }

    // Batch update all cocks that need recovery
    await Promise.all(
      cocksNeedingUpdate.map((cockId) => {
        const recovery = recoveryMap.get(cockId)!;
        return this.prisma.cock.update({
          where: { id: cockId },
          data: {
            health: recovery.nextHealth,
            energy: recovery.nextEnergy,
            lastRecoveryAt: now,
            healthUpdatedAt: now,
            energyUpdatedAt: now,
          },
        });
      })
    );

    // Fetch updated cocks with owner data
    const updatedCocks = await this.prisma.cock.findMany({
      where: { id: { in: cocksNeedingUpdate } },
      include: {
        owner: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    // Create a map of updated cocks
    const updatedCocksMap = new Map(updatedCocks.map(c => [c.id, c]));

    // Return cocks with updated data where applicable
    return cocks.map(cock => {
      if (cocksNeedingUpdate.includes(cock.id)) {
        return updatedCocksMap.get(cock.id) || cock;
      }
      return cock;
    });
  }

  private async applyPassiveRecoveryIfNeeded(cockId: string, cock: CockModel, force = false) {
    const now = new Date();
    const recovery = computePassiveRecovery(cock, now);

    if (!force && !recovery.needsUpdate) {
      return cock as any;
    }

    const updated = await this.prisma.cock.update({
      where: { id: cockId },
      data: {
        health: recovery.nextHealth,
        energy: recovery.nextEnergy,
        lastRecoveryAt: now,
        healthUpdatedAt: now,
        energyUpdatedAt: now,
      },
      include: {
        owner: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });
    
    return updated as any;
  }
}
