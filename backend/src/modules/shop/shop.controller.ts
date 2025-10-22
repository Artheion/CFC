import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ShopService } from './shop.service';
import { AdminService } from '../admin/admin.service';
import { BuyItemDto } from './dto/buy-item.dto';
import { SpinWheelDto } from './dto/spin-wheel.dto';
import { Public } from '../auth/decorators/public.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('shop')
export class ShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly adminService: AdminService,
  ) {}

  @Public()
  @Get('catalog')
  listCatalog() {
    return this.shopService.listCatalog();
  }

  @Public()
  @Get('prices')
  getPrices() {
    return this.adminService.getPrices();
  }

  @Post('items/buy')
  buyItem(@Req() req: AuthenticatedRequest, @Body() dto: BuyItemDto) {
    return this.shopService.buyItem(req.user.userId, dto);
  }

  @Post('roulette/spin')
  spinWheel(@Req() req: AuthenticatedRequest, @Body() dto: SpinWheelDto) {
    return this.shopService.spinWheel(req.user.userId, dto);
  }
}
