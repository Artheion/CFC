import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ChickensService } from './chickens.service';
import { UpdateChickenDto } from './dto/update-chicken.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('chickens')
export class ChickensController {
  constructor(private readonly chickensService: ChickensService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.chickensService.listUserChickens(req.user.userId);
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') chickenId: string) {
    return this.chickensService.getChickenForUser(req.user.userId, chickenId);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') chickenId: string,
    @Body() dto: UpdateChickenDto,
  ) {
    return this.chickensService.updateChickenProfile(req.user.userId, chickenId, dto);
  }
}
