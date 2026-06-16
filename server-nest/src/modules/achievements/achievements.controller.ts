import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { AchievementsService } from './achievements.service';

/**
 * /api/achievements — tasks + badges. Mirrors server/src/routes/achievements.js.
 */
@Controller('api/achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  overview(@CurrentUser() user: User) {
    return this.achievements.overview(user);
  }

  @Get('user/:id/badges')
  @UseGuards(OptionalAuthGuard)
  userBadgeWall(@Param('id') id: string, @CurrentUser() user: User | null) {
    return this.achievements.userBadgeWall(Number(id), user);
  }

  @Post('claim/:key')
  @UseGuards(JwtAuthGuard)
  claim(@Param('key') key: string, @CurrentUser() user: User) {
    return this.achievements.claim(key, user);
  }
}
