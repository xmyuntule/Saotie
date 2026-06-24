import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FlashService } from './flash.service';
import { CreateFlashDto } from './dto/flash.dto';

/**
 * /api/flash — 资讯快报. Mirrors server/src/routes/flash.js.
 */
@Controller('api/flash')
export class FlashController {
  constructor(private readonly flash: FlashService) {}

  @Get()
  list(@Query('limit') limit: string, @Query('category') category: string) {
    return this.flash.list(limit, category);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateFlashDto) {
    return this.flash.create(user, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.flash.remove(user, Number(id));
  }
}
