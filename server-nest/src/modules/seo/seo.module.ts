import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Board, Circle, Post, Question, Thread, Topic, User } from '../../database/entities';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { SiteModule } from '../site/site.module';

@Module({
  imports: [SiteModule, TypeOrmModule.forFeature([Article, Board, Circle, Post, Question, Thread, Topic, User])],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
