import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Post, Question, Thread, ViewHistory } from '../../database/entities';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

@Module({
  imports: [TypeOrmModule.forFeature([ViewHistory, Post, Thread, Article, Question])],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
