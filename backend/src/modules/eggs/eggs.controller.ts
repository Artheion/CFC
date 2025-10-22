import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EggsService } from './eggs.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('eggs')
export class EggsController {
  constructor(private readonly eggsService: EggsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.eggsService.listUserEggs(req.user.userId);
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') eggId: string) {
    return this.eggsService.getEgg(req.user.userId, eggId);
  }

  @Post(':id/incubate')
  incubate(@Req() req: AuthenticatedRequest, @Param('id') eggId: string) {
    return this.eggsService.startIncubation(req.user.userId, eggId);
  }

  @Post(':id/hatch')
  hatch(@Req() req: AuthenticatedRequest, @Param('id') eggId: string) {
    return this.eggsService.hatchEgg(req.user.userId, eggId);
  }
}
