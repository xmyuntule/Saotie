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
import { QaService } from './qa.service';
import { AnswerDto, AskQuestionDto } from './dto/qa.dto';

/**
 * /api/qa — questions / answers / votes. Mirrors server/src/routes/qa.js.
 * `/spotlight` and `/answers/:id/vote` are declared before the `:id` routes so
 * the matcher behaves like Express.
 */
@Controller('api/qa')
export class QaController {
  constructor(private readonly qa: QaService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(
    @Query('status') status: string,
    @Query('category') category: string,
    @Query('sort') sort: string,
    @CurrentUser() user: User | null,
  ) {
    return this.qa.list(status, category, sort, user);
  }

  @Get('spotlight')
  @UseGuards(OptionalAuthGuard)
  spotlight(@CurrentUser() user: User | null) {
    return this.qa.spotlight(user);
  }

  @Post('answers/:id/vote')
  @UseGuards(JwtAuthGuard)
  voteAnswer(@Param('id') id: string, @CurrentUser() user: User) {
    return this.qa.voteAnswer(Number(id), user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  ask(@CurrentUser() user: User, @Body() dto: AskQuestionDto) {
    return this.qa.ask(user, dto);
  }

  @Post(':id/answers')
  @UseGuards(JwtAuthGuard)
  answer(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: AnswerDto,
  ) {
    return this.qa.answer(Number(id), user, dto);
  }

  @Post(':id/accept/:answerId')
  @UseGuards(JwtAuthGuard)
  accept(
    @Param('id') id: string,
    @Param('answerId') answerId: string,
    @CurrentUser() user: User,
  ) {
    return this.qa.accept(Number(id), Number(answerId), user);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('id') id: string, @CurrentUser() user: User | null) {
    return this.qa.detail(Number(id), user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  adminRemove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.qa.adminRemove(user, Number(id));
  }
}
