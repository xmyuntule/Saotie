import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Board, Circle, Post, Question, Thread, Topic, User } from '../../database/entities';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Board, Circle, Post, Question, Thread, Topic, User])],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
