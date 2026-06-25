import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NavService } from './nav.service';
import { CreateCategoryDto, CreateLinkDto } from './dto/nav.dto';

/**
 * /api/nav — 网址导航. Mirrors server/src/routes/nav.js. Static routes precede
 * the `:id/click` route.
 */
@Controller('api/nav')
export class NavController {
  constructor(private readonly nav: NavService) {}

  @Get()
  directory() {
    return this.nav.directory();
  }

  @Get('popular')
  popular() {
    return this.nav.popular();
  }

  // ===== 个人收藏夹 =====
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  myDirectory(@CurrentUser() user: User) {
    return this.nav.myDirectory(user);
  }

  @Post('mine')
  @UseGuards(JwtAuthGuard)
  addMyLink(@CurrentUser() user: User, @Body() dto: { title?: string; url?: string; description?: string }) {
    return this.nav.addMyLink(user, dto);
  }

  @Delete('mine/:id')
  @UseGuards(JwtAuthGuard)
  removeMyLink(@CurrentUser() user: User, @Param('id') id: string) {
    return this.nav.removeMyLink(user, Number(id));
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  createCategory(@CurrentUser() user: User, @Body() dto: CreateCategoryDto) {
    return this.nav.createCategory(user, dto);
  }

  @Post('links')
  @UseGuards(JwtAuthGuard)
  createLink(@CurrentUser() user: User, @Body() dto: CreateLinkDto) {
    return this.nav.createLink(user, dto);
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard)
  updateCategory(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CreateCategoryDto) {
    return this.nav.updateCategory(user, Number(id), dto);
  }

  @Put('links/:id')
  @UseGuards(JwtAuthGuard)
  updateLink(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CreateLinkDto) {
    return this.nav.updateLink(user, Number(id), dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  removeCategory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.nav.removeCategory(user, Number(id));
  }

  @Delete('links/:id')
  @UseGuards(JwtAuthGuard)
  removeLink(@CurrentUser() user: User, @Param('id') id: string) {
    return this.nav.removeLink(user, Number(id));
  }

  @Post(':id/click')
  click(@Param('id') id: string) {
    return this.nav.click(Number(id));
  }
}
