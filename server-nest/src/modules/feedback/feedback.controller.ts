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
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, ReplyFeedbackDto } from './dto/feedback.dto';

/**
 * /api/feedback — 问题反馈. Mirrors server/src/routes/feedback.js.
 */
@Controller('api/feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(user, dto);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query('status') status: string, @CurrentUser() user: User | null) {
    return this.feedback.list(status, user);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard)
  reply(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ReplyFeedbackDto,
  ) {
    return this.feedback.reply(Number(id), user, dto);
  }
}
