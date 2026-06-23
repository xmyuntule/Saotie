import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CheckinService } from './checkin.service';

/** /api/checkin — 签到中心 + 补签. Mirrors server/src/routes/checkin.js. */
@Controller('api/checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  hub(@CurrentUser() user: User | null) {
    return this.checkin.hub(user || null);
  }

  @Post('makeup')
  @UseGuards(JwtAuthGuard)
  makeup(@CurrentUser() user: User, @Body('date') date: string) {
    return this.checkin.makeup(user, date);
  }
}
