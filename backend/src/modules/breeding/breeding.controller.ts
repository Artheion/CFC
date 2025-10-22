import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BreedingService } from './breeding.service';
import { StartBreedingDto } from './dto/start-breeding.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('breeding')
export class BreedingController {
  constructor(private readonly breedingService: BreedingService) {}

  @Post('start')
  start(@Req() req: AuthenticatedRequest, @Body() dto: StartBreedingDto) {
    return this.breedingService.startBreeding(req.user.userId, dto);
  }

  @Post('process')
  process(@Req() req: AuthenticatedRequest) {
    return this.breedingService.processDueSessions(req.user.userId);
  }

  @Get('active')
  listActive(@Req() req: AuthenticatedRequest) {
    return this.breedingService.listActiveSessions(req.user.userId);
  }
}
