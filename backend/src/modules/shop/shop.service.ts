import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType, WheelSpinResult, CockRarity, ChickenRarity } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { BuyItemDto } from './dto/buy-item.dto';
import { SpinWheelDto } from './dto/spin-wheel.dto';
import { JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShopService {
  private static readonly DEFAULT_WHEEL_COST_BNB = new Prisma.Decimal(0.001);
  private provider: JsonRpcProvider;
  private treasuryAddress: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly referralsService: ReferralsService,
    private readonly configService: ConfigService,
  ) {
    const rpcEndpoint = this.configService.get<string>('BNB_RPC_ENDPOINT');
    this.provider = new JsonRpcProvider(rpcEndpoint);
    this.treasuryAddress = (this.configService.get<string>('TREASURY_ADDRESS') || '').toLowerCase();
  }

  private async getWheelCost(): Promise<Prisma.Decimal> {
    const config = await this.prisma.appConfig.findUnique({
      where: { key: 'rouletteCost' },
    });
    
    if (config) {
      const parsed = parseFloat(config.value);
      if (!isNaN(parsed)) {
        return new Prisma.Decimal(parsed);
      }
    }
    
    return ShopService.DEFAULT_WHEEL_COST_BNB;
  }

  async listCatalog() {
    const items = await this.prisma.itemCatalog.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    // Transform Decimal fields to strings for JSON serialization
    return items.map((item) => ({
      ...item,
      priceBnb: item.priceBnb.toString(),
      priceCfc: item.priceCfc.toString(),
    }));
  }

  async buyItem(userId: string, dto: BuyItemDto) {
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      include: {
        referredBy: true
      }
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new ForbiddenException('Account is banned from transactions');
    }

    const item = await this.prisma.itemCatalog.findFirst({
      where: { slug: dto.itemSlug, isActive: true },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const quantity = dto.quantity ?? 1;
    let totalCost = item.priceCfc.mul(quantity);
    
    // Apply discount if user has referral code with discount
    if (user.referredBy && user.referredBy.discountPercent > 0) {
      const discountMultiplier = new Prisma.Decimal(1).sub(
        new Prisma.Decimal(user.referredBy.discountPercent).div(100)
      );
      totalCost = totalCost.mul(discountMultiplier);
    }

    // Check if CFC token contract is deployed
    const cfcTokenAddress = this.configService.get<string>('CFC_TOKEN_ADDRESS');
    
    if (cfcTokenAddress && cfcTokenAddress !== '') {
      // CFC contract is deployed - require payment verification
      if (!dto.paymentSignature) {
        throw new BadRequestException('CFC token payment signature is required');
      }

      // Verify CFC token transfer transaction
      await this.verifyTokenTransfer(
        dto.paymentSignature,
        user.walletAddress,
        totalCost
      );
      
      console.log('[Shop] CFC token payment verified:', dto.paymentSignature);
    } else {
      // CFC contract not deployed yet - allow purchases without payment for development
      console.log('[Shop] CFC contract not deployed. Allowing purchase without payment verification.');
    }

    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { userId, itemCatalogId: item.id },
    });

    if (item.maxPerUser && inventoryItem && inventoryItem.quantity + quantity > item.maxPerUser) {
      throw new ForbiddenException('Purchase exceeds per-user limit for this item');
    }

    const { transaction, inventory } = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          fromUserId: user.id,
          fromWallet: user.walletAddress,
          amount: totalCost,
          type: TransactionType.PURCHASE,
          status: TransactionStatus.PENDING,
          signature: dto.paymentSignature,
          metadata: {
            itemSlug: item.slug,
            quantity,
          },
        },
      });

      const inventory = await tx.inventoryItem.upsert({
        where: { userId_itemCatalogId: { userId, itemCatalogId: item.id } },
        create: {
          userId,
          itemCatalogId: item.id,
          quantity,
        },
        update: {
          quantity: (inventoryItem?.quantity ?? 0) + quantity,
        },
        include: { itemCatalog: true },
      });

      return { transaction, inventory };
    });

    await this.referralsService.queueReferralPayout(transaction.id);

    return inventory;
  }

  async spinWheel(userId: string, dto: SpinWheelDto) {
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      include: {
        referredBy: true
      }
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new ForbiddenException('Account is banned from transactions');
    }

    let cost = await this.getWheelCost();
    let isFreeSpin = false;

    // Check if user has a free spin available
    if (user.referredBy && user.referredBy.freeWheelSpins > 0 && !user.hasUsedFreeSpin) {
      isFreeSpin = true;
      cost = new Prisma.Decimal(0);
    } else if (user.referredBy && user.referredBy.discountPercent > 0) {
      // Apply discount if available
      const discountMultiplier = new Prisma.Decimal(1).sub(
        new Prisma.Decimal(user.referredBy.discountPercent).div(100)
      );
      cost = cost.mul(discountMultiplier);
    }

    // Only verify payment if not a free spin
    if (!isFreeSpin) {
      // Verify payment signature is provided
      if (!dto.paymentSignature) {
        throw new BadRequestException('Payment transaction signature is required');
      }

      // Verify the transaction on-chain
      const isValidPayment = await this.verifyPaymentTransaction(
        dto.paymentSignature,
        user.walletAddress,
        cost,
      );

      if (!isValidPayment) {
        throw new BadRequestException('Invalid payment transaction. Please ensure you sent the correct amount to the treasury.');
      }
    }

    const outcome = this.rollWheel();
    const wheelType = dto.wheelType?.trim() || 'standard';

    const result = await this.prisma.$transaction(async (tx) => {
      let createdCockId: string | null = null;
      let createdChickenId: string | null = null;

      // Generate cock or chicken based on outcome
      if (outcome.resultType === WheelSpinResult.COCK && outcome.rarity) {
        const cockData = await this.generateCockStats(outcome.rarity, userId);
        const newCock = await tx.cock.create({
          data: {
            ...cockData,
            ownerId: userId,
          },
        });
        createdCockId = newCock.id;
      } else if (outcome.resultType === WheelSpinResult.CHICKEN && outcome.rarity) {
        const chickenData = await this.generateChickenStats(outcome.rarity, userId);
        const newChicken = await tx.chicken.create({
          data: {
            ...chickenData,
            ownerId: userId,
          },
        });
        createdChickenId = newChicken.id;
      }

      // Get the created entity to include template info
      let createdCock = null;
      let createdChicken = null;
      
      if (createdCockId) {
        createdCock = await tx.cock.findUnique({ where: { id: createdCockId } });
        console.log('[Shop Service] Created cock from DB:', JSON.stringify(createdCock, null, 2));
      }
      if (createdChickenId) {
        createdChicken = await tx.chicken.findUnique({ where: { id: createdChickenId } });
        console.log('[Shop Service] Created chicken from DB:', JSON.stringify(createdChicken, null, 2));
      }

      const spin = await tx.wheelSpin.create({
        data: {
          userId,
          resultType: outcome.resultType,
          resultReferenceId: createdCockId || createdChickenId,
          resultRarity: outcome.rarity,
          costBnb: cost,
          metadata: {
            wheelType,
            reward: {
              resultType: outcome.resultType,
              referenceId: createdCockId || createdChickenId,
              rarity: outcome.rarity,
              cockId: createdCockId,
              chickenId: createdChickenId,
              templateId: createdCock?.templateId || createdChicken?.templateId,
              image: createdCock?.image || createdChicken?.image,
            },
          },
          signature: dto.paymentSignature,
        },
      });

      // If free spin was used, mark it and decrement the code's free spins
      if (isFreeSpin && user.referredBy) {
        await tx.user.update({
          where: { id: userId },
          data: { hasUsedFreeSpin: true }
        });
        
        await tx.referralCode.update({
          where: { id: user.referredBy.id },
          data: { freeWheelSpins: { decrement: 1 } }
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          fromUserId: user.id,
          fromWallet: user.walletAddress,
          amount: cost,
          type: TransactionType.PURCHASE,
          status: TransactionStatus.PENDING,
          signature: dto.paymentSignature || 'FREE_SPIN',
          wheelSpinId: spin.id,
          metadata: isFreeSpin ? { freeSpin: true, referralCode: user.referredByCode } : undefined,
        },
      });

      return { 
        spin, 
        transaction, 
        createdCock: createdCock || undefined,
        createdChicken: createdChicken || undefined,
        isFreeSpin,
      };
    });

    // Only queue referral payout if it's not a free spin
    if (!result.isFreeSpin) {
      await this.referralsService.queueReferralPayout(result.transaction.id);
    }

    // Add the full cock/chicken data to the spin response
    const responseData: any = {
      ...result.spin,
      cock: result.createdCock,
      chicken: result.createdChicken,
      isFreeSpin: result.isFreeSpin,
    };

    console.log('[Shop Service] Returning response with cock/chicken:', {
      hasCock: !!responseData.cock,
      hasChicken: !!responseData.chicken,
      cockData: responseData.cock ? {
        id: responseData.cock.id,
        name: responseData.cock.name,
        image: responseData.cock.image,
        templateId: responseData.cock.templateId,
        rarity: responseData.cock.rarity,
      } : null,
      chickenData: responseData.chicken ? {
        id: responseData.chicken.id,
        name: responseData.chicken.name,
        image: responseData.chicken.image,
        templateId: responseData.chicken.templateId,
        rarity: responseData.chicken.rarity,
      } : null,
    });

    return responseData;
  }

  private async generateCockStats(rarity: string, userId: string) {
    // ALL cocks have identical stats (45 in all), only energy varies by rarity
    const RARITY_ENERGY: Record<string, number> = {
      common: 300,
      uncommon: 350,
      rare: 400,
      epic: 450,
      legendary: 500,
    };

    // Count ALL existing cocks globally for sequential numbering
    const existingCocksCount = await this.prisma.cock.count();

    // Cock image templates by rarity - only templateId and image vary, stats are fixed per rarity
    const COCK_TEMPLATES: Record<string, Array<{ templateId: string; image: string }>> = {
      legendary: [
        { templateId: "cock_legendary_001", image: "/assets/Cocks/Legendary/Cock 1.jpg" },
        { templateId: "cock_legendary_002", image: "/assets/Cocks/Legendary/Cock 2.jpg" },
        { templateId: "cock_legendary_003", image: "/assets/Cocks/Legendary/Cock 3.jpg" },
        { templateId: "cock_legendary_004", image: "/assets/Cocks/Legendary/Cock 4.jpg" },
        { templateId: "cock_legendary_005", image: "/assets/Cocks/Legendary/Cock 5.jpg" },
        { templateId: "cock_legendary_006", image: "/assets/Cocks/Legendary/Cock 6.jpg" },
        { templateId: "cock_legendary_007", image: "/assets/Cocks/Legendary/Cock 7.jpg" },
        { templateId: "cock_legendary_008", image: "/assets/Cocks/Legendary/Cock 8.jpg" },
        { templateId: "cock_legendary_009", image: "/assets/Cocks/Legendary/Cock 9.png" },
      ],
      epic: [
        { templateId: "cock_epic_001", image: "/assets/Cocks/Epic/Cock 1.png" },
        { templateId: "cock_epic_002", image: "/assets/Cocks/Epic/Cock 2.png" },
        { templateId: "cock_epic_003", image: "/assets/Cocks/Epic/Cock 3.png" },
        { templateId: "cock_epic_004", image: "/assets/Cocks/Epic/Cock 4.jpg" },
        { templateId: "cock_epic_005", image: "/assets/Cocks/Epic/Cock 5.jpg" },
        { templateId: "cock_epic_006", image: "/assets/Cocks/Epic/Cock 6.png" },
        { templateId: "cock_epic_007", image: "/assets/Cocks/Epic/Cock 7.jpg" },
        { templateId: "cock_epic_008", image: "/assets/Cocks/Epic/Cock 8.jpg" },
        { templateId: "cock_epic_009", image: "/assets/Cocks/Epic/Cock 9.jpg" },
        { templateId: "cock_epic_010", image: "/assets/Cocks/Epic/Cock 10.jpg" },
        { templateId: "cock_epic_011", image: "/assets/Cocks/Epic/Cock 11.jpg" },
      ],
      rare: [
        { templateId: "cock_rare_001", image: "/assets/Cocks/Rare/Cock 1.png" },
        { templateId: "cock_rare_002", image: "/assets/Cocks/Rare/Cock 2.jpg" },
        { templateId: "cock_rare_003", image: "/assets/Cocks/Rare/Cock 3.png" },
        { templateId: "cock_rare_004", image: "/assets/Cocks/Rare/Cock 4.jpg" },
        { templateId: "cock_rare_005", image: "/assets/Cocks/Rare/Cock 5.png" },
        { templateId: "cock_rare_006", image: "/assets/Cocks/Rare/Cock 6.jpg" },
        { templateId: "cock_rare_007", image: "/assets/Cocks/Rare/Cock 7.jpg" },
        { templateId: "cock_rare_008", image: "/assets/Cocks/Rare/Cock 8.jpg" },
        { templateId: "cock_rare_009", image: "/assets/Cocks/Rare/Cock 9.jpg" },
        { templateId: "cock_rare_010", image: "/assets/Cocks/Rare/Cock 10.jpg" },
        { templateId: "cock_rare_011", image: "/assets/Cocks/Rare/Cock 11.png" },
        { templateId: "cock_rare_012", image: "/assets/Cocks/Rare/Cock 12.jpg" },
        { templateId: "cock_rare_013", image: "/assets/Cocks/Rare/Cock 13.jpg" },
        { templateId: "cock_rare_014", image: "/assets/Cocks/Rare/Cock 14.jpg" },
        { templateId: "cock_rare_015", image: "/assets/Cocks/Rare/Cock 15.jpg" },
        { templateId: "cock_rare_016", image: "/assets/Cocks/Rare/Cock 16.jpg" },
        { templateId: "cock_rare_017", image: "/assets/Cocks/Rare/Cock 17.png" },
        { templateId: "cock_rare_018", image: "/assets/Cocks/Rare/Cock 18.jpg" },
        { templateId: "cock_rare_019", image: "/assets/Cocks/Rare/Cock 19.jpg" },
      ],
      uncommon: [
        { templateId: "cock_uncommon_001", image: "/assets/Cocks/Uncommon/Cock 1.png" },
        { templateId: "cock_uncommon_002", image: "/assets/Cocks/Uncommon/Cock 2.png" },
        { templateId: "cock_uncommon_003", image: "/assets/Cocks/Uncommon/Cock 3.jpg" },
        { templateId: "cock_uncommon_004", image: "/assets/Cocks/Uncommon/Cock 4.jpg" },
        { templateId: "cock_uncommon_005", image: "/assets/Cocks/Uncommon/Cock 5.png" },
        { templateId: "cock_uncommon_006", image: "/assets/Cocks/Uncommon/Cock 6.jpg" },
        { templateId: "cock_uncommon_007", image: "/assets/Cocks/Uncommon/Cock 7.jpg" },
        { templateId: "cock_uncommon_008", image: "/assets/Cocks/Uncommon/Cock 8.jpg" },
        { templateId: "cock_uncommon_009", image: "/assets/Cocks/Uncommon/Cock 9.jpg" },
        { templateId: "cock_uncommon_010", image: "/assets/Cocks/Uncommon/Cock 10.jpg" },
        { templateId: "cock_uncommon_011", image: "/assets/Cocks/Uncommon/Cock 11.jpg" },
        { templateId: "cock_uncommon_012", image: "/assets/Cocks/Uncommon/Cock 12.png" },
        { templateId: "cock_uncommon_013", image: "/assets/Cocks/Uncommon/Cock 13.jpg" },
        { templateId: "cock_uncommon_014", image: "/assets/Cocks/Uncommon/Cock 14.jpg" },
        { templateId: "cock_uncommon_015", image: "/assets/Cocks/Uncommon/Cock 15.png" },
        { templateId: "cock_uncommon_016", image: "/assets/Cocks/Uncommon/Cock 16.png" },
        { templateId: "cock_uncommon_017", image: "/assets/Cocks/Uncommon/Cock 17.jpg" },
        { templateId: "cock_uncommon_018", image: "/assets/Cocks/Uncommon/Cock 18.jpg" },
        { templateId: "cock_uncommon_019", image: "/assets/Cocks/Uncommon/Cock 19.jpg" },
        { templateId: "cock_uncommon_020", image: "/assets/Cocks/Uncommon/Cock 20.png" },
        { templateId: "cock_uncommon_021", image: "/assets/Cocks/Uncommon/Cock 21.jpg" },
        { templateId: "cock_uncommon_022", image: "/assets/Cocks/Uncommon/Cock 22.jpg" },
      ],
      common: [
        { templateId: "cock_common_001", image: "/assets/Cocks/Common/Cock 1.jpg" },
        { templateId: "cock_common_002", image: "/assets/Cocks/Common/Cock 2.png" },
        { templateId: "cock_common_003", image: "/assets/Cocks/Common/Cock 3.png" },
        { templateId: "cock_common_004", image: "/assets/Cocks/Common/Cock 4.png" },
        { templateId: "cock_common_005", image: "/assets/Cocks/Common/Cock 5.png" },
        { templateId: "cock_common_006", image: "/assets/Cocks/Common/Cock 6.png" },
        { templateId: "cock_common_007", image: "/assets/Cocks/Common/Cock 7.jpg" },
        { templateId: "cock_common_008", image: "/assets/Cocks/Common/Cock 8.jpg" },
        { templateId: "cock_common_009", image: "/assets/Cocks/Common/Cock 9.jpg" },
        { templateId: "cock_common_010", image: "/assets/Cocks/Common/Cock 10.jpg" },
        { templateId: "cock_common_011", image: "/assets/Cocks/Common/Cock 11.png" },
        { templateId: "cock_common_012", image: "/assets/Cocks/Common/Cock 12.jpg" },
        { templateId: "cock_common_013", image: "/assets/Cocks/Common/Cock 13.jpg" },
        { templateId: "cock_common_014", image: "/assets/Cocks/Common/Cock 14.jpg" },
        { templateId: "cock_common_015", image: "/assets/Cocks/Common/Cock 15.jpg" },
        { templateId: "cock_common_016", image: "/assets/Cocks/Common/Cock 16.jpg" },
        { templateId: "cock_common_017", image: "/assets/Cocks/Common/Cock 17.jpg" },
        { templateId: "cock_common_018", image: "/assets/Cocks/Common/Cock 18.jpg" },
        { templateId: "cock_common_019", image: "/assets/Cocks/Common/Cock 19.jpg" },
        { templateId: "cock_common_020", image: "/assets/Cocks/Common/Cock 20.jpg" },
        { templateId: "cock_common_021", image: "/assets/Cocks/Common/Cock 21.jpg" },
        { templateId: "cock_common_022", image: "/assets/Cocks/Common/Cock 22.jpg" },
        { templateId: "cock_common_023", image: "/assets/Cocks/Common/Cock 23.jpg" },
        { templateId: "cock_common_024", image: "/assets/Cocks/Common/Cock 24.jpg" },
        { templateId: "cock_common_025", image: "/assets/Cocks/Common/Cock 25.jpg" },
        { templateId: "cock_common_026", image: "/assets/Cocks/Common/Cock 26.png" },
        { templateId: "cock_common_027", image: "/assets/Cocks/Common/Cock 27.png" },
        { templateId: "cock_common_028", image: "/assets/Cocks/Common/Cock 28.png" },
        { templateId: "cock_common_029", image: "/assets/Cocks/Common/Cock 29.png" },
        { templateId: "cock_common_030", image: "/assets/Cocks/Common/Cock 30.jpg" },
      ],
    };

    // Pick a random template from the rarity (for variety in appearance)
    const templates = COCK_TEMPLATES[rarity] || COCK_TEMPLATES.common;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Get energy for this rarity
    const maxEnergy = RARITY_ENERGY[rarity] || 300;

    const cockNumber = existingCocksCount + 1;
    
    return {
      templateId: template.templateId,
      name: `CFC Cock #${cockNumber}`,
      description: `CFC Cock #${cockNumber}, fresh meat in the CFC. Untested, unnamed, but ready to spill blood and earn respect. Every cock starts somewhere, this one's ready to peck his way to the top.`,
      image: template.image,
      rarity: rarity as CockRarity,
      attack: 45,
      defence: 45,
      stamina: 45,
      speed: 45,
      health: 100,
      energy: maxEnergy,
      maxEnergy: maxEnergy,
    };
  }

  private async generateChickenStats(rarity: string, userId: string) {
    // Count ALL existing chickens globally for sequential numbering
    const existingChickensCount = await this.prisma.chicken.count();
    
    // Chicken templates by rarity - MUST match frontend chickens.ts and actual files
    const CHICKEN_TEMPLATES: Record<string, Array<{ templateId: string; image: string }>> = {
      legendary: [
        { templateId: "chicken_legendary_001", image: "/assets/Chickens/Legendary/Chicken 1.jpg" },
        { templateId: "chicken_legendary_002", image: "/assets/Chickens/Legendary/Chicken 2.png" },
      ],
      epic: [
        { templateId: "chicken_epic_001", image: "/assets/Chickens/Epic/Chicken 1.jpg" },
        { templateId: "chicken_epic_002", image: "/assets/Chickens/Epic/Chicken 2.jpg" },
      ],
      rare: [
        { templateId: "chicken_rare_001", image: "/assets/Chickens/Rare/Chicken 1.png" },
        { templateId: "chicken_rare_002", image: "/assets/Chickens/Rare/Chicken 2.jpg" },
        { templateId: "chicken_rare_003", image: "/assets/Chickens/Rare/Chicken 3.jpg" },
      ],
      uncommon: [
        { templateId: "chicken_uncommon_001", image: "/assets/Chickens/Uncommon/Chicken 1.png" },
        { templateId: "chicken_uncommon_002", image: "/assets/Chickens/Uncommon/Chicken 2.jpg" },
        { templateId: "chicken_uncommon_003", image: "/assets/Chickens/Uncommon/Chicken 3.jpg" },
      ],
      common: [
        { templateId: "chicken_common_001", image: "/assets/Chickens/Common/Chicken 1.jpg" },
        { templateId: "chicken_common_002", image: "/assets/Chickens/Common/Chicken 2.jpg" },
        { templateId: "chicken_common_003", image: "/assets/Chickens/Common/Chicken 3.jpg" },
      ],
    };

    // Pick a random template from the rarity
    const templates = CHICKEN_TEMPLATES[rarity] || CHICKEN_TEMPLATES.common;
    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      templateId: template.templateId,
      name: `CFC Chicken #${existingChickensCount + 1}`,
      description: 'A beautiful hen ready for breeding.',
      image: template.image,
      rarity: rarity as ChickenRarity,
    };
  }

  private rollWheel(): {
    resultType: WheelSpinResult;
    referenceId: string | null;
    rarity: string | null;
  } {
    // Rarity weights matching frontend
    const RARITY_WEIGHTS = [
      { rarity: 'common', weight: 45 },
      { rarity: 'uncommon', weight: 30 },
      { rarity: 'rare', weight: 15 },
      { rarity: 'epic', weight: 8 },
      { rarity: 'legendary', weight: 2 },
    ];

    // Pick rarity based on weights
    const totalWeight = RARITY_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedRarity = 'common';

    for (const entry of RARITY_WEIGHTS) {
      if (roll < entry.weight) {
        selectedRarity = entry.rarity;
        break;
      }
      roll -= entry.weight;
    }

    // 90% chance for cock, 10% chance for chicken
    const isCock = Math.random() < 0.9;

    return {
      resultType: isCock ? WheelSpinResult.COCK : WheelSpinResult.CHICKEN,
      referenceId: null, // Actual cock/chicken will be generated by backend
      rarity: selectedRarity,
    };
  }

  private async verifyTokenTransfer(
    txHash: string,
    expectedSender: string,
    expectedAmount: Prisma.Decimal,
  ): Promise<void> {
    const provider = this.provider;
    const treasuryAddress = this.configService.get<string>('TREASURY_ADDRESS');
    const cfcTokenAddress = this.configService.get<string>('CFC_TOKEN_ADDRESS');

    if (!treasuryAddress) {
      throw new BadRequestException('Treasury address not configured');
    }

    if (!cfcTokenAddress) {
      throw new BadRequestException('CFC token address not configured');
    }

    try {
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        throw new BadRequestException('Transaction not found or not yet confirmed');
      }

      if (receipt.status !== 1) {
        throw new BadRequestException('Transaction failed on blockchain');
      }

      // Check if transaction is to the CFC token contract
      if (receipt.to?.toLowerCase() !== cfcTokenAddress.toLowerCase()) {
        throw new BadRequestException('Transaction is not to CFC token contract');
      }

      // Parse Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      const transferLog = receipt.logs.find(
        (log: any) => log.topics[0] === transferEventSignature &&
               log.topics[1]?.toLowerCase() === '0x' + expectedSender.slice(2).toLowerCase().padStart(64, '0') &&
               log.topics[2]?.toLowerCase() === '0x' + treasuryAddress.slice(2).toLowerCase().padStart(64, '0')
      );

      if (!transferLog) {
        throw new BadRequestException(
          'No valid Transfer event found from your wallet to treasury'
        );
      }

      // Decode the amount from the event data
      const transferredAmount = BigInt(transferLog.data);
      
      // Convert expected amount to BigInt (avoid scientific notation)
      // Multiply by 10^18 for 18 decimals token
      const expectedAmountDecimal = expectedAmount.mul(new Prisma.Decimal('1000000000000000000'));
      // Use toFixed(0) to avoid scientific notation like "1e+22"
      const expectedAmountStr = expectedAmountDecimal.toFixed(0);
      
      console.log('[Shop] Token verification:', {
        expectedAmount: expectedAmount.toString(),
        expectedAmountDecimal: expectedAmountDecimal.toString(),
        expectedAmountStr,
        transferredAmount: transferredAmount.toString()
      });
      
      const expectedAmountBigInt = BigInt(expectedAmountStr);

      if (transferredAmount < expectedAmountBigInt) {
        throw new BadRequestException(
          `Insufficient token amount. Expected: ${expectedAmount.toString()}, Got: ${(Number(transferredAmount) / 1e18).toFixed(0)}`
        );
      }

      console.log('[Shop] Token transfer verified successfully');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('[Shop] Token verification error:', error);
      throw new BadRequestException('Failed to verify token payment');
    }
  }

  private async verifyPaymentTransaction(
    txHash: string,
    fromAddress: string,
    expectedAmount: Prisma.Decimal,
  ): Promise<boolean> {
    try {
      // Fetch transaction receipt from blockchain
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        console.error('[ShopService] Transaction not found:', txHash);
        return false;
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        console.error('[ShopService] Transaction failed on-chain:', txHash);
        return false;
      }

      // Fetch full transaction details
      const tx = await this.provider.getTransaction(txHash);
      
      if (!tx) {
        console.error('[ShopService] Transaction details not found:', txHash);
        return false;
      }

      // Verify sender
      if (tx.from.toLowerCase() !== fromAddress.toLowerCase()) {
        console.error('[ShopService] Transaction sender mismatch. Expected:', fromAddress, 'Got:', tx.from);
        return false;
      }

      // Verify recipient (treasury)
      if (!tx.to || tx.to.toLowerCase() !== this.treasuryAddress) {
        console.error('[ShopService] Transaction recipient mismatch. Expected:', this.treasuryAddress, 'Got:', tx.to);
        return false;
      }

      // Verify amount (allow small rounding differences due to gas)
      const sentAmount = Number(formatEther(tx.value));
      const expected = Number(expectedAmount);
      const tolerance = 0.0001; // Allow 0.0001 BNB difference for gas fluctuations

      if (Math.abs(sentAmount - expected) > tolerance) {
        console.error('[ShopService] Transaction amount mismatch. Expected:', expected, 'Got:', sentAmount);
        return false;
      }

      console.log('[ShopService] ✅ Payment verified:', txHash, 'Amount:', sentAmount, 'BNB');
      return true;
    } catch (error) {
      console.error('[ShopService] Error verifying transaction:', error);
      return false;
    }
  }
}
