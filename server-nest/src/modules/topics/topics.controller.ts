import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { TopicsService } from './topics.service';

/**
 * /api/topics — hot topics + topic follows + topic feed.
 * Mirrors server/src/routes/topics.js. Static routes precede the `:name`
 * catch-all so '/following' matches before being read as a topic name.
 */
@Controller('api/topics')
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get()
  list(@Query('q') q: string) {
    return this.topics.list(q);
  }

  @Get('following')
  @UseGuards(JwtAuthGuard)
  following(@CurrentUser() user: User) {
    return this.topics.following(user);
  }

  @Get(':name')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('name') name: string, @CurrentUser() user: User | null) {
    return this.topics.detail(name, user);
  }

  @Post(':name/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('name') name: string, @CurrentUser() user: User) {
    return this.topics.follow(name, user);
  }
}
