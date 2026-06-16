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
import { AiService } from './ai.service';
import { SendAiMessageDto } from './dto/ai.dto';

/**
 * /api/ai — integrated AI assistant. Mirrors server/src/routes/ai.js.
 * `/status` is public; conversation routes require auth.
 */
@Controller('api/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return this.ai.status();
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  listConversations(@CurrentUser() user: User) {
    return this.ai.listConversations(user);
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  createConversation(@CurrentUser() user: User) {
    return this.ai.createConversation(user);
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  getConversation(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ai.getConversation(Number(id), user);
  }

  @Delete('conversations/:id')
  @UseGuards(JwtAuthGuard)
  deleteConversation(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ai.deleteConversation(Number(id), user);
  }

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: SendAiMessageDto,
  ) {
    return this.ai.sendMessage(Number(id), user, dto);
  }
}
