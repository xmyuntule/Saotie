import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FlashService, type FlashHotResponse } from './flash.service';
import { CreateFlashDto } from './dto/flash.dto';

/**
 * /api/flash — 资讯快报. Mirrors server/src/routes/flash.js.
 */
@Controller('api/flash')
export class FlashController {
  constructor(private readonly flash: FlashService) {}

  @Get('hot/sources')
  hotSources(@Query('disabled') disabled: string) {
    return this.flash.hotSources(disabled === '1' || disabled === 'true');
  }

  @Get('hot/:source')
  hotList(@Param('source') source: string, @Query('refresh') refresh: string): Promise<FlashHotResponse> {
    return this.flash.hotList(source, refresh === '1' || refresh === 'true');
  }

  @Post('hot/:source/refresh')
  refreshHot(@Param('source') source: string): Promise<FlashHotResponse> {
    return this.flash.refreshHot(source);
  }

  @Get()
  list(@Query('limit') limit: string, @Query('category') category: string, @Query('q') q: string) {
    return this.flash.list(limit, category, q);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateFlashDto) {
    return this.flash.create(user, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CreateFlashDto) {
    return this.flash.update(user, Number(id), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.flash.remove(user, Number(id));
  }
}
