import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Answer, AnswerVote, Question, User } from '../../database/entities';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';

@Module({
  imports: [TypeOrmModule.forFeature([Question, Answer, AnswerVote, User])],
  controllers: [QaController],
  providers: [QaService],
})
export class QaModule {}
