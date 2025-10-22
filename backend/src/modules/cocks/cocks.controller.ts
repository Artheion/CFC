import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CocksService } from './cocks.service';
import { UpdateCockDto } from './dto/update-cock.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('cocks')
export class CocksController {
  constructor(private readonly cocksService: CocksService) {}

  @Get()
  listUserCocks(@Req() req: AuthenticatedRequest) {
    return this.cocksService.listUserCocks(req.user.userId);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.cocksService.getLeaderboard();
  }

  @Get(':id')
  getCock(@Req() req: AuthenticatedRequest, @Param('id') cockId: string) {
    return this.cocksService.getCockForUser(req.user.userId, cockId);
  }

  @Patch(':id')
  updateCock(
    @Req() req: AuthenticatedRequest,
    @Param('id') cockId: string,
    @Body() dto: UpdateCockDto,
  ) {
    return this.cocksService.updateCockProfile(req.user.userId, cockId, dto);
  }

  @Post(':id/rest')
  restCock(@Req() req: AuthenticatedRequest, @Param('id') cockId: string) {
    return this.cocksService.triggerRecovery(req.user.userId, cockId);
  }
}
