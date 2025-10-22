import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BreedingStatus, EggStatus, FightStatus } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { BREEDING_DURATION_MS, EGG_HATCH_DURATION_MS } from '@common/utils/breeding';
import { StartBreedingDto } from './dto/start-breeding.dto';

@Injectable()
export class BreedingService {
  constructor(private readonly prisma: PrismaService) {}

  async startBreeding(userId: string, dto: StartBreedingDto) {
    const [cock, chicken] = await Promise.all([
      this.prisma.cock.findFirst({ where: { id: dto.cockId, ownerId: userId } }),
      this.prisma.chicken.findFirst({ where: { id: dto.chickenId, ownerId: userId } }),
    ]);

    if (!cock) {
      throw new NotFoundException('Cock not found');
    }

    if (!chicken) {
      throw new NotFoundException('Chicken not found');
    }

    if (cock.isBreeding) {
      throw new BadRequestException('Cock is already breeding');
    }

    if (chicken.isBreeding) {
      throw new BadRequestException('Chicken is already breeding');
    }

    const activeSession = await this.prisma.breedingSession.findFirst({
      where: { userId, status: BreedingStatus.ACTIVE },
    });

    if (activeSession) {
      throw new BadRequestException('A breeding session is already in progress');
    }

    const activeFight = await this.prisma.fight.findFirst({
      where: {
        status: { in: [FightStatus.QUEUED, FightStatus.BETTING, FightStatus.FIGHTING] },
        OR: [{ cock1Id: cock.id }, { cock2Id: cock.id }],
      },
    });

    if (activeFight) {
      throw new BadRequestException('Cock is currently queued or fighting');
    }

    const completesAt = new Date(Date.now() + BREEDING_DURATION_MS);

    const session = await this.prisma.$transaction(async (tx) => {
      const createdSession = await tx.breedingSession.create({
        data: {
          userId,
          cockId: cock.id,
          chickenId: chicken.id,
          completesAt,
        },
      });

      await tx.cock.update({
        where: { id: cock.id },
        data: {
          isBreeding: true,
          breedingEndTime: completesAt,
        },
      });

      await tx.chicken.update({
        where: { id: chicken.id },
        data: {
          isBreeding: true,
          breedingEndTime: completesAt,
        },
      });

      return createdSession;
    });

    return session;
  }

  async processDueSessions(userId: string) {
    const now = new Date();

    const sessions = await this.prisma.breedingSession.findMany({
      where: {
        userId,
        status: BreedingStatus.ACTIVE,
        completesAt: { lte: now },
      },
    });

    const eggs = [] as Array<{ id: string }>;

    for (const session of sessions) {
      const egg = await this.prisma.$transaction(async (tx) => {
        const createdEgg = await tx.egg.create({
          data: {
            ownerId: userId,
            image: '/assets/Eggs/Standard.png',
            hatchTimeMs: EGG_HATCH_DURATION_MS,
            isIncubating: false,
            parentCockId: session.cockId,
            parentChickenId: session.chickenId,
            status: EggStatus.FRESH,
          },
        });

        await tx.breedingSession.update({
          where: { id: session.id },
          data: {
            status: BreedingStatus.COMPLETED,
            eggId: createdEgg.id,
            completedAt: now,
          },
        });

        await tx.cock.update({
          where: { id: session.cockId },
          data: {
            isBreeding: false,
            breedingEndTime: null,
          },
        });

        await tx.chicken.update({
          where: { id: session.chickenId },
          data: {
            isBreeding: false,
            breedingEndTime: null,
          },
        });

        return createdEgg;
      });

      eggs.push({ id: egg.id });
    }

    return {
      processed: sessions.length,
      eggsCreated: eggs,
    };
  }

  listActiveSessions(userId: string) {
    return this.prisma.breedingSession.findMany({
      where: { userId, status: BreedingStatus.ACTIVE },
      orderBy: { completesAt: 'asc' },
    });
  }
}
