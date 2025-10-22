import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InventoryService } from './inventory.service';
import { UseItemDto } from './dto/use-item.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.listInventory(req.user.userId);
  }

  @Post('use')
  use(@Req() req: AuthenticatedRequest, @Body() dto: UseItemDto) {
    return this.inventoryService.useItem(req.user.userId, dto);
  }
}
