import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemType } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { UseItemDto } from './dto/use-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listInventory(userId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { userId },
      include: { itemCatalog: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async useItem(userId: string, dto: UseItemDto) {
    const itemCatalog = await this.prisma.itemCatalog.findUnique({
      where: { slug: dto.itemSlug },
    });

    if (!itemCatalog || !itemCatalog.isActive) {
      throw new NotFoundException('Item not available');
    }

    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { userId, itemCatalogId: itemCatalog.id },
    });

    if (!inventoryItem || inventoryItem.quantity <= 0) {
      throw new BadRequestException('Item not in inventory');
    }

    const cock = await this.prisma.cock.findFirst({
      where: { id: dto.cockId, ownerId: userId },
    });

    if (!cock) {
      throw new NotFoundException('Target cock not found');
    }

    const now = new Date();

    switch (itemCatalog.type) {
      case ItemType.MEDKIT: {
        if (cock.health >= 100) {
          throw new BadRequestException('Cock already has full health');
        }
        if (cock.health >= 50) {
          throw new BadRequestException('Cock health must be below 50 to use Med Kit');
        }
        const restoreAmount = Math.max(1, Math.floor(100 * 0.5));
        const nextHealth = Math.min(100, cock.health + restoreAmount);

        return this.prisma.$transaction(async (tx) => {
          const updatedInventory = await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { quantity: inventoryItem.quantity - 1 },
          });

          const updatedCock = await tx.cock.update({
            where: { id: cock.id },
            data: {
              health: nextHealth,
              healthUpdatedAt: now,
            },
          });

          return { cock: updatedCock, remainingQuantity: updatedInventory.quantity };
        });
      }
      case ItemType.CAPSULE: {
        if (cock.energy >= cock.maxEnergy) {
          throw new BadRequestException('Cock already has full energy');
        }
        const energyThreshold = Math.floor(cock.maxEnergy * 0.75);
        if (cock.energy >= energyThreshold) {
          throw new BadRequestException(
            `Cock energy must be below ${energyThreshold} to use Energy Capsule`
          );
        }
        const restoreAmount = Math.max(1, Math.floor(cock.maxEnergy * 0.25));
        const nextEnergy = Math.min(cock.maxEnergy, cock.energy + restoreAmount);

        return this.prisma.$transaction(async (tx) => {
          const updatedInventory = await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { quantity: inventoryItem.quantity - 1 },
          });

          const updatedCock = await tx.cock.update({
            where: { id: cock.id },
            data: {
              energy: nextEnergy,
              energyUpdatedAt: now,
            },
          });

          return { cock: updatedCock, remainingQuantity: updatedInventory.quantity };
        });
      }
      default:
        throw new BadRequestException('Unsupported item type');
    }
  }
}
