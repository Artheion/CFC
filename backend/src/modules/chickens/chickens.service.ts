import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { UpdateChickenDto } from './dto/update-chicken.dto';

@Injectable()
export class ChickensService {
  constructor(private readonly prisma: PrismaService) {}

  listUserChickens(userId: string) {
    return this.prisma.chicken.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getChickenForUser(userId: string, chickenId: string) {
    const chicken = await this.prisma.chicken.findFirst({
      where: { id: chickenId, ownerId: userId },
    });

    if (!chicken) {
      throw new NotFoundException('Chicken not found');
    }

    return chicken;
  }

  async updateChickenProfile(userId: string, chickenId: string, dto: UpdateChickenDto) {
    await this.getChickenForUser(userId, chickenId);

    if (!dto.name && !dto.description) {
      throw new BadRequestException('No updates provided');
    }

    return this.prisma.chicken.update({
      where: { id: chickenId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }
}
