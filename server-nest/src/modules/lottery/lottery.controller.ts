import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { LotteryService } from './lottery.service';

/** /api/lottery — 幸运抽奖. Mirrors server/src/routes/lottery.js. */
@Controller('api/lottery')
export class LotteryController {
  constructor(private readonly lottery: LotteryService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  board(@CurrentUser() user: User | null) {
    return this.lottery.board(user || null);
  }

  @Get('winners')
  winners() {
    return this.lottery.winners();
  }

  @Post('draw')
  @UseGuards(JwtAuthGuard)
  draw(@CurrentUser() user: User) {
    return this.lottery.draw(user);
  }

  // ===== 管理员：奖品配置 =====
  @Get('prizes')
  @UseGuards(JwtAuthGuard)
  adminList(@CurrentUser() user: User) {
    return this.lottery.adminList(user);
  }

  @Post('prizes')
  @UseGuards(JwtAuthGuard)
  upsertPrize(@CurrentUser() user: User, @Body() dto: any) {
    return this.lottery.upsertPrize(user, dto);
  }

  @Delete('prizes/:id')
  @UseGuards(JwtAuthGuard)
  removePrize(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lottery.removePrize(user, Number(id));
  }
}
