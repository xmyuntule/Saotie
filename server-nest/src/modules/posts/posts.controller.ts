import {
  Body,
  Controller,
  Delete,
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
import { PostsService } from './posts.service';
import {
  CreatePostDto,
  RewardDto,
  ShareDto,
  UnlockDto,
  UpdatePostDto,
  VoteDto,
} from './dto/post.dto';

/**
 * /api/posts — feed + CRUD + interactions.
 * Mirrors server/src/routes/posts.js. Static / multi-segment routes are
 * declared before the catch-all `:id` so the matcher behaves like Express.
 */
@Controller('api/posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  // Feed (paginated)
  @Get()
  @UseGuards(OptionalAuthGuard)
  feed(
    @CurrentUser() user: User | null,
    @Query('filter') filter = 'all',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.posts.feed(user, filter, limit, offset);
  }

  // Create
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.posts.create(user, dto);
  }

  // Posts by a user (profile)
  @Get('user/:username')
  @UseGuards(OptionalAuthGuard)
  byUser(
    @Param('username') username: string,
    @CurrentUser() user: User | null,
  ) {
    return this.posts.byUser(username, user);
  }

  // Posts a user liked
  @Get('liked/:username')
  @UseGuards(OptionalAuthGuard)
  liked(
    @Param('username') username: string,
    @CurrentUser() user: User | null,
  ) {
    return this.posts.likedByUser(username, user);
  }

  // Related posts
  @Get(':id/related')
  @UseGuards(OptionalAuthGuard)
  related(@Param('id') id: string, @CurrentUser() user: User | null) {
    return this.posts.related(Number(id), user);
  }

  // Prev/next by same author
  @Get(':id/siblings')
  @UseGuards(OptionalAuthGuard)
  siblings(@Param('id') id: string) {
    return this.posts.siblings(Number(id));
  }

  // Vote
  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  vote(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: VoteDto,
  ) {
    return this.posts.vote(Number(id), user, dto);
  }

  // 抢红包
  @Post(':id/grab')
  @UseGuards(JwtAuthGuard)
  grab(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.grab(Number(id), user);
  }

  // Share / repost
  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  share(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ShareDto,
  ) {
    return this.posts.share(Number(id), user, dto);
  }

  // Like / unlike
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  like(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.like(Number(id), user);
  }

  // Unlock paid / password
  @Post(':id/unlock')
  @UseGuards(JwtAuthGuard)
  unlock(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UnlockDto,
  ) {
    return this.posts.unlock(Number(id), user, dto.password);
  }

  // Reward / 打赏
  @Post(':id/reward')
  @UseGuards(JwtAuthGuard)
  reward(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: RewardDto,
  ) {
    return this.posts.reward(Number(id), user, dto.amount);
  }

  // Pin / unpin
  @Post(':id/pin')
  @UseGuards(JwtAuthGuard)
  pin(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.pin(Number(id), user);
  }

  // Global pin / 全站置顶
  @Post(':id/global-pin')
  @UseGuards(JwtAuthGuard)
  globalPin(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.globalPin(Number(id), user);
  }

  // Bookmark / 收藏
  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  bookmark(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.bookmark(Number(id), user);
  }

  // Edit
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(Number(id), user, dto);
  }

  // Delete
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.remove(Number(id), user);
  }

  // Single post (increments views) — keep last among GET :id routes
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: User | null) {
    return this.posts.findOne(Number(id), user);
  }
}
