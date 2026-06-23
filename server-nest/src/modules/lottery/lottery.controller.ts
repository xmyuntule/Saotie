import { Controller, Get, Post, UseGuards } from '@nestjs/common';
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
}
