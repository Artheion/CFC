import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FightStatus, SpectatorBetStatus } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PlaceBetDto } from './dto/place-bet.dto';

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  listUserBets(userId: string) {
    return this.prisma.spectatorBet.findMany({
      where: { userId },
      orderBy: { placedAt: 'desc' },
      include: {
        fight: {
          include: {
            cock1: true,
            cock2: true,
          },
        },
      },
    });
  }

  async placeBet(userId: string, fightId: string, dto: PlaceBetDto) {
    const fight = await this.prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        cock1: true,
        cock2: true,
      },
    });

    if (!fight) {
      throw new NotFoundException('Fight not found');
    }

    if (fight.status !== FightStatus.BETTING) {
      throw new BadRequestException('Betting is closed for this fight');
    }

    if (!fight.cock2Id || !fight.cock2) {
      throw new BadRequestException('Fight is not ready for betting');
    }

    if (dto.cockId !== fight.cock1Id && dto.cockId !== fight.cock2Id) {
      throw new BadRequestException('Bet must target a participating cock');
    }

    const existingBet = await this.prisma.spectatorBet.findFirst({
      where: { fightId, userId },
    });

    if (existingBet) {
      throw new BadRequestException('You have already placed a bet on this fight');
    }

    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.spectatorBet.create({
      data: {
        fightId,
        userId,
        cockId: dto.cockId,
        amount,
        status: SpectatorBetStatus.PENDING,
        payoutSignature: dto.paymentSignature || null,
      },
      include: {
        fight: {
          include: {
            cock1: true,
            cock2: true,
          },
        },
      },
    });
  }
}
