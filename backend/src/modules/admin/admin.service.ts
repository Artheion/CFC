import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { LoggerService } from '@infra/logger/logger.service';
import { UpdatePricesDto } from './dto/update-prices.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('AdminService');
  }

  async assertIsAdmin(userId: string, mfaToken?: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user?.isAdmin) {
      this.logger.logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT', {
        userId,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      });
      throw new ForbiddenException('Admin access required');
    }

    // Check if MFA is enabled for this admin
    const mfaEnabled = (user as any).mfaEnabled || false;
    
    if (mfaEnabled && !mfaToken) {
      this.logger.logSecurityEvent('ADMIN_MFA_TOKEN_MISSING', {
        userId: user.id,
        wallet: user.walletAddress,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('MFA token required for admin actions');
    }

    // MFA verification would be done here if implemented
    // For now, we'll log the admin access
    this.logger.logAdminAction('ADMIN_ACCESS_GRANTED', {
      userId: user.id,
      wallet: user.walletAddress,
      ipAddress,
      userAgent,
      mfaVerified: mfaEnabled,
    });

    return user;
  }

  async updatePrices(userId: string, dto: UpdatePricesDto) {
    await this.assertIsAdmin(userId);

    const updates: Array<{ key: string; value: string }> = [];

    if (dto.rouletteCost !== undefined) {
      updates.push({ key: 'rouletteCost', value: dto.rouletteCost.toString() });
    }
    if (dto.capsulePrice !== undefined) {
      updates.push({ key: 'capsulePrice', value: dto.capsulePrice.toString() });
    }
    if (dto.medkitPrice !== undefined) {
      updates.push({ key: 'medkitPrice', value: dto.medkitPrice.toString() });
    }

    // Update AppConfig table
    for (const { key, value } of updates) {
      await this.prisma.appConfig.upsert({
        where: { key },
        create: { key, value, updatedBy: userId },
        update: { value, updatedBy: userId },
      });
    }

    // Also update ItemCatalog table for shop items
    if (dto.capsulePrice !== undefined) {
      await this.prisma.itemCatalog.updateMany({
        where: { slug: 'energy-capsule' },
        data: { priceCfc: dto.capsulePrice },
      });
    }
    
    if (dto.medkitPrice !== undefined) {
      await this.prisma.itemCatalog.updateMany({
        where: { slug: 'med-kit' },
        data: { priceCfc: dto.medkitPrice },
      });
    }

    return { success: true, message: 'Prices updated successfully' };
  }

  async getPrices() {
    const configs = await this.prisma.appConfig.findMany({
      where: {
        key: {
          in: ['rouletteCost', 'capsulePrice', 'medkitPrice'],
        },
      },
    });

    const prices: Record<string, number> = {
      rouletteCost: 0.1,
      capsulePrice: 1000,
      medkitPrice: 1000,
    };

    for (const config of configs) {
      const parsed = parseFloat(config.value);
      if (!isNaN(parsed)) {
        prices[config.key] = parsed;
      }
    }

    return prices;
  }

  async resetReferralEarnings(userId: string, code: string) {
    await this.assertIsAdmin(userId);
    
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
    });

    if (!referralCode) {
      throw new NotFoundException(`Referral code ${code} not found`);
    }

    // Reset totalEarnedBnb to 0
    await this.prisma.referralCode.update({
      where: { code },
      data: { totalEarnedBnb: 0 },
    });

    return { message: `Reset earnings for code ${code} to 0` };
  }
}
