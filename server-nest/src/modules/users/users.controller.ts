import {
  Body,
  Controller,
  Get,
  NotFoundException,
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
import { UsersService } from './users.service';
import { RechargeDto, UpdateProfileDto } from './dto/user.dto';

/**
 * /api/users — mirrors server/src/routes/users.js. Static and /me/* routes
 * are declared before the dynamic :username / :id routes so Express-style
 * precedence is preserved.
 */
@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Mention autocomplete
  @Get('mention')
  @UseGuards(OptionalAuthGuard)
  mention(@Query('q') q = '', @CurrentUser() user: User | null) {
    return this.users.mention(q, user);
  }

  // My bookmarks
  @Get('me/bookmarks')
  @UseGuards(JwtAuthGuard)
  myBookmarks(@CurrentUser() user: User, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.users.myBookmarks(user, limit, offset);
  }

  // My block list
  @Get('me/blocks')
  @UseGuards(JwtAuthGuard)
  myBlocks(@CurrentUser() user: User) {
    return this.users.myBlocks(user);
  }

  // My profile stats (会员中心：获赞/浏览/访客/收到评论)
  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  meStats(@CurrentUser() user: User) {
    return this.users.meStats(user);
  }

  // My asset logs (points / balance)
  @Get('me/assets')
  @UseGuards(JwtAuthGuard)
  meAssets(@CurrentUser() user: User) {
    return this.users.meAssets(user);
  }

  // My invite code + referral stats (邀请好友)
  @Get('me/invites')
  @UseGuards(JwtAuthGuard)
  meInvites(@CurrentUser() user: User) {
    return this.users.meInvites(user);
  }

  // Update own profile
  @Put('me/profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }

  // Recharge wallet
  @Post('me/recharge')
  @UseGuards(JwtAuthGuard)
  recharge(@CurrentUser() user: User, @Body() dto: RechargeDto) {
    return this.users.recharge(user, dto);
  }

  // Check-in leaderboard
  @Get('ranking/checkin')
  @UseGuards(OptionalAuthGuard)
  rankingCheckin(@CurrentUser() user: User | null) {
    return this.users.rankingCheckin(user);
  }

  // Leaderboards by type
  @Get('ranking/:type')
  @UseGuards(OptionalAuthGuard)
  ranking(@Param('type') type: string, @CurrentUser() user: User | null) {
    return this.users.ranking(type, user);
  }

  // Suggested users
  @Get('suggestions')
  @UseGuards(OptionalAuthGuard)
  suggestions(@CurrentUser() user: User | null) {
    return this.users.suggestions(user);
  }

  // Block / unblock
  @Post(':id/block')
  @UseGuards(JwtAuthGuard)
  block(@Param('id') id: string, @CurrentUser() user: User) {
    return this.users.toggleBlock(user, Number(id));
  }

  // Is the viewer blocking this user?
  @Get(':id/blocked')
  @UseGuards(JwtAuthGuard)
  blocked(@Param('id') id: string, @CurrentUser() user: User) {
    return this.users.isBlocked(user, Number(id));
  }

  // Follow / unfollow
  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('id') id: string, @CurrentUser() user: User) {
    return this.users.toggleFollow(user, Number(id));
  }

  // Recent profile visitors (最近访客, owner-only) — must precede :username/:rel
  @Get(':username/visitors')
  @UseGuards(JwtAuthGuard)
  visitors(@Param('username') username: string, @CurrentUser() user: User) {
    return this.users.visitors(username, user);
  }

  // Followers / following lists
  @Get(':username/:rel')
  @UseGuards(OptionalAuthGuard)
  relations(
    @Param('username') username: string,
    @Param('rel') rel: string,
    @CurrentUser() user: User | null,
  ) {
    if (rel !== 'followers' && rel !== 'following') {
      throw new NotFoundException('用户不存在');
    }
    return this.users.relations(username, rel, user);
  }

  // Profile by username (catch-all single segment — declared last)
  @Get(':username')
  @UseGuards(OptionalAuthGuard)
  profile(
    @Param('username') username: string,
    @CurrentUser() user: User | null,
  ) {
    return this.users.profile(username, user);
  }
}
