import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HistoryService } from './history.service';

/** /api/history — 浏览足迹. Mirrors server/src/routes/history.js. */
@Controller('api/history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.history.list(user.id);
  }

  @Delete(':type/:id')
  removeOne(@CurrentUser() user: User, @Param('type') type: string, @Param('id') id: string) {
    return this.history.removeOne(user.id, type, Number(id));
  }

  @Delete()
  clear(@CurrentUser() user: User) {
    return this.history.clear(user.id);
  }
}
