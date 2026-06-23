import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Comment, Like } from '../../database/entities';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Like, Comment])],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
