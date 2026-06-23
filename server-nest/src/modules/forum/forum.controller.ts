import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { ForumService } from './forum.service';
import {
  CreateThreadDto,
  ModerateThreadDto,
  UpdateThreadDto,
} from './dto/forum.dto';

/**
 * /api/forum — boards + threads. Mirrors server/src/routes/forum.js.
 * Route declaration order matches Express precedence: `/threads/user/:username`
 * before `/threads/:id`, static board routes before `/boards/:slug`.
 */
@Controller('api/forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('boards')
  @UseGuards(OptionalAuthGuard)
  listBoards(@CurrentUser() user: User | null) {
    return this.forum.listBoards(user);
  }

  @Get('my-boards')
  @UseGuards(JwtAuthGuard)
  myBoards(@CurrentUser() user: User) {
    return this.forum.myBoards(user);
  }

  @Post('boards/:id/follow')
  @UseGuards(JwtAuthGuard)
  followBoard(@Param('id') id: string, @CurrentUser() user: User) {
    return this.forum.followBoard(Number(id), user);
  }

  @Get('boards/:slug')
  @UseGuards(OptionalAuthGuard)
  boardDetail(
    @Param('slug') slug: string,
    @Query('sort') sort: string,
    @CurrentUser() user: User | null,
  ) {
    return this.forum.boardDetail(slug, sort, user);
  }

  @Get('threads')
  @UseGuards(OptionalAuthGuard)
  listThreads(@Query('sort') sort: string, @CurrentUser() user: User | null) {
    return this.forum.listThreads(sort, user);
  }

  @Get('threads/user/:username')
  @UseGuards(OptionalAuthGuard)
  threadsByUser(
    @Param('username') username: string,
    @CurrentUser() user: User | null,
  ) {
    return this.forum.threadsByUser(username, user);
  }

  @Post('threads')
  @UseGuards(JwtAuthGuard)
  createThread(@CurrentUser() user: User, @Body() dto: CreateThreadDto) {
    return this.forum.createThread(user, dto);
  }

  @Post('threads/:id/like')
  @UseGuards(JwtAuthGuard)
  likeThread(@Param('id') id: string, @CurrentUser() user: User) {
    return this.forum.likeThread(Number(id), user);
  }

  @Post('threads/:id/subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Param('id') id: string, @CurrentUser() user: User) {
    return this.forum.subscribe(Number(id), user);
  }

  @Post('boards/:id/purchase')
  @UseGuards(JwtAuthGuard)
  purchaseBoard(@Param('id') id: string, @CurrentUser() user: User) {
    return this.forum.purchaseBoard(Number(id), user);
  }

  @Put('threads/:id')
  @UseGuards(JwtAuthGuard)
  updateThread(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.forum.updateThread(Number(id), user, dto);
  }

  @Post('threads/:id/moderate')
  @UseGuards(JwtAuthGuard)
  moderate(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ModerateThreadDto,
  ) {
    return this.forum.moderate(Number(id), user, dto);
  }

  @Get('threads/:id')
  @UseGuards(OptionalAuthGuard)
  threadDetail(@Param('id') id: string, @CurrentUser() user: User | null) {
    return this.forum.threadDetail(Number(id), user);
  }
}
