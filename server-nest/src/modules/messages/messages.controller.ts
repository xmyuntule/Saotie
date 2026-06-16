import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { ConversationSettingsDto, SendMessageDto } from './dto/message.dto';

/**
 * /api/messages — 私信. Mirrors server/src/routes/messages.js. All routes
 * require auth. Static routes (`/`, `/unread`, `:peerId/settings`) precede the
 * `:peerId` catch-all to match Express precedence.
 */
@Controller('api/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  conversations(@CurrentUser() user: User) {
    return this.messages.conversations(user);
  }

  @Get('unread')
  unread(@CurrentUser() user: User) {
    return this.messages.unread(user);
  }

  @Post(':peerId/settings')
  updateSettings(
    @Param('peerId') peerId: string,
    @CurrentUser() user: User,
    @Body() dto: ConversationSettingsDto,
  ) {
    return this.messages.updateSettings(user, Number(peerId), dto);
  }

  @Get(':peerId')
  thread(@Param('peerId') peerId: string, @CurrentUser() user: User) {
    return this.messages.thread(user, Number(peerId));
  }

  @Delete(':peerId')
  remove(@Param('peerId') peerId: string, @CurrentUser() user: User) {
    return this.messages.remove(user, Number(peerId));
  }

  @Post(':peerId')
  send(
    @Param('peerId') peerId: string,
    @CurrentUser() user: User,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(user, Number(peerId), dto);
  }
}
