import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CockRarity, Egg, EggStatus } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { getRandomCockTemplateByRarity } from '@common/data/cock-templates';
import {
  calculateMaxEnergyForRarity,
  calculateOffspringRarity,
  calculateOffspringStats,
} from '@common/utils/breeding';

@Injectable()
export class EggsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUserEggs(userId: string) {
    const eggs = await this.prisma.egg.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(eggs.map((egg) => this.refreshEggStateIfNeeded(egg.id, egg)));
  }

  async getEgg(userId: string, eggId: string) {
    const egg = await this.findOwnedEgg(userId, eggId);
    return this.refreshEggStateIfNeeded(egg.id, egg);
  }

  async startIncubation(userId: string, eggId: string) {
    const egg = await this.findOwnedEgg(userId, eggId);

    if (egg.status !== EggStatus.FRESH && egg.status !== EggStatus.READY_TO_HATCH) {
      throw new BadRequestException('Egg is already incubating or hatched');
    }

    const now = new Date();
    const readyAt = new Date(now.getTime() + egg.hatchTimeMs);

    return this.prisma.egg.update({
      where: { id: eggId },
      data: {
        isIncubating: true,
        incubationStart: now,
        readyAt,
        status: EggStatus.INCUBATING,
      },
    });
  }

  async hatchEgg(userId: string, eggId: string) {
    const egg = await this.findOwnedEgg(userId, eggId);
    const updated = await this.refreshEggStateIfNeeded(egg.id, egg);

    if (updated.status !== EggStatus.READY_TO_HATCH) {
      throw new BadRequestException('Egg is not ready to hatch yet');
    }

    const now = new Date();
    const [parentCock, parentChicken] = await Promise.all([
      updated.parentCockId
        ? this.prisma.cock.findUnique({ where: { id: updated.parentCockId } })
        : Promise.resolve(null),
      updated.parentChickenId
        ? this.prisma.chicken.findUnique({ where: { id: updated.parentChickenId } })
        : Promise.resolve(null),
    ]);

    const offspringRarity = parentCock && parentChicken
      ? calculateOffspringRarity(parentCock.rarity, parentChicken.rarity)
      : 'common';

    const template = getRandomCockTemplateByRarity(offspringRarity);

    // Fixed stats: ALL cocks have 45 for all stats regardless of rarity or breeding
    const fixedStats = {
      attack: 45,
      defence: 45,
      stamina: 45,
      speed: 45,
    };

    const maxEnergy = calculateMaxEnergyForRarity(offspringRarity);
    const cockCount = await this.prisma.cock.count({ where: { ownerId: userId } });
    const generatedName = `CFC Cock #${cockCount + 1}`;

    return this.prisma.$transaction(async (tx) => {
      const hatchedEgg = await tx.egg.update({
        where: { id: eggId },
        data: {
          status: EggStatus.HATCHED,
          hatchedAt: now,
          isIncubating: false,
        },
      });

      const cock = await tx.cock.create({
        data: {
          ownerId: userId,
          templateId: template.templateId,
          name: generatedName,
          description: '',
          image: template.image,
          rarity: offspringRarity as CockRarity,
          attack: fixedStats.attack,
          defence: fixedStats.defence,
          stamina: fixedStats.stamina,
          speed: fixedStats.speed,
          health: 100,
          energy: maxEnergy,
          maxEnergy,
          lastRestedAt: now,
          lastRecoveryAt: now,
        },
      });

      return { egg: hatchedEgg, cock };
    });
  }

  private async findOwnedEgg(userId: string, eggId: string) {
    const egg = await this.prisma.egg.findFirst({
      where: { id: eggId, ownerId: userId },
    });

    if (!egg) {
      throw new NotFoundException('Egg not found');
    }

    return egg;
  }

  private async refreshEggStateIfNeeded(eggId: string, egg: Egg) {
    if (egg.status !== EggStatus.INCUBATING) {
      return egg;
    }

    if (!egg.readyAt) {
      return egg;
    }

    if (egg.readyAt.getTime() > Date.now()) {
      return egg;
    }

    return this.prisma.egg.update({
      where: { id: eggId },
      data: {
        status: EggStatus.READY_TO_HATCH,
        isIncubating: false,
      },
    });
  }
}
