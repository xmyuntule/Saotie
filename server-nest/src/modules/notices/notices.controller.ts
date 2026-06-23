import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/jwt-auth.guard';
import { NoticesService } from './notices.service';

/** /api/notices — 全站运营公告. Mirrors server/src/routes/notices.js. */
@Controller('api/notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  // 公开：生效公告（banner）
  @Get()
  list() {
    return this.notices.listPublic();
  }

  // 以下管理端：requireAuth + requireAdmin
  @Get('all')
  @UseGuards(AdminGuard)
  all() {
    return this.notices.listAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.notices.create(user, body);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.notices.update(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notices.remove(user, Number(id));
  }
}
