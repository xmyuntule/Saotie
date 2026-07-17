import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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

  @Get('admin/tasks')
  @UseGuards(AdminGuard)
  adminTasks() {
    return this.achievements.adminTasks();
  }

  @Put('admin/tasks')
  @UseGuards(AdminGuard)
  updateAdminTasks(@Body() body: any) {
    return this.achievements.updateAdminTasks(body);
  }

  @Post('admin/tasks/reset')
  @UseGuards(AdminGuard)
  resetAdminTasks() {
    return this.achievements.resetAdminTasks();
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
