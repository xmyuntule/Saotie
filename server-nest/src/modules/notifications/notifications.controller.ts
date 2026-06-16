import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

/**
 * /api/notifications — list / unread count / mark read.
 * Mirrors server/src/routes/notifications.js. All routes require auth.
 */
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.notifications.list(user);
  }

  @Get('unread')
  unread(@CurrentUser() user: User) {
    return this.notifications.unread(user);
  }

  @Post('read')
  readAll(@CurrentUser() user: User) {
    return this.notifications.readAll(user);
  }

  @Post(':id/read')
  readOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.notifications.readOne(Number(id), user);
  }
}
