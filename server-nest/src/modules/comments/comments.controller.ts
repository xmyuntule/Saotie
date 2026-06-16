import {
  Body,
  Controller,
  Delete,
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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comment.dto';

/**
 * /api/comments — nested comments on posts & threads + likes.
 * Mirrors server/src/routes/comments.js.
 */
@Controller('api/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(
    @Query('postId') postId: string,
    @Query('threadId') threadId: string,
    @Query('sort') sort: string,
    @CurrentUser() user: User | null,
  ) {
    return this.comments.list(postId, threadId, sort, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateCommentDto) {
    return this.comments.create(user, dto);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  like(@Param('id') id: string, @CurrentUser() user: User) {
    return this.comments.like(Number(id), user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.comments.remove(Number(id), user);
  }
}
