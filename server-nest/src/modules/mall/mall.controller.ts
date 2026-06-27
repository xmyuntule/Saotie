import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { MallService } from './mall.service';

/**
 * /api/mall — 积分商城. Mirrors server/src/routes/mall.js.
 */
@Controller('api/mall')
export class MallController {
  constructor(private readonly mall: MallService) {}

  @Get('products')
  @UseGuards(OptionalAuthGuard)
  listProducts(@CurrentUser() user: User | null, @Query('q') q: string) {
    return this.mall.listProducts(user, q);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  listOrders(@CurrentUser() user: User) {
    return this.mall.listOrders(user);
  }

  @Get('inventory')
  @UseGuards(JwtAuthGuard)
  inventory(@CurrentUser() user: User) {
    return this.mall.inventory(user);
  }

  // 管理员：兑换记录
  @Get('admin/orders')
  @UseGuards(JwtAuthGuard)
  adminOrders(@CurrentUser() user: User) {
    return this.mall.adminOrders(user);
  }

  @Post('products/:id/redeem')
  @UseGuards(JwtAuthGuard)
  redeem(@Param('id') id: string, @CurrentUser() user: User) {
    return this.mall.redeem(Number(id), user);
  }
}
