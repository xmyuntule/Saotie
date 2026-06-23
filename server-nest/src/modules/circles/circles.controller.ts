import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CirclesService } from './circles.service';
import { CreateCircleDto } from './dto/circle.dto';

/**
 * /api/circles — interest communities. Mirrors server/src/routes/circles.js.
 * Static `/suggestions` precedes the `:slug` catch-all.
 */
@Controller('api/circles')
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(
    @Query('category') category: string,
    @Query('sort') sort: string,
    @Query('mine') mine: string,
    @CurrentUser() user: User | null,
  ) {
    return this.circles.list(category, sort, mine, user);
  }

  @Get('suggestions')
  @UseGuards(OptionalAuthGuard)
  suggestions(@CurrentUser() user: User | null) {
    return this.circles.suggestions(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateCircleDto) {
    return this.circles.create(user, dto);
  }

  @Get(':slug')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('slug') slug: string, @CurrentUser() user: User | null) {
    return this.circles.detail(slug, user);
  }

  @Get(':slug/posts')
  @UseGuards(OptionalAuthGuard)
  feed(
    @Param('slug') slug: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @CurrentUser() user: User | null,
  ) {
    return this.circles.feed(slug, limit, offset, user);
  }

  @Get(':slug/chat')
  @UseGuards(OptionalAuthGuard)
  chatList(@Param('slug') slug: string, @CurrentUser() user: User | null) {
    return this.circles.chatList(slug, user);
  }

  @Post(':slug/chat')
  @UseGuards(JwtAuthGuard)
  chatSend(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
    @Body('content') content: string,
  ) {
    return this.circles.chatSend(slug, user, content);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(@Param('id') id: string, @CurrentUser() user: User) {
    return this.circles.join(Number(id), user);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  leave(@Param('id') id: string, @CurrentUser() user: User) {
    return this.circles.leave(Number(id), user);
  }
}
