import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Collection, CollectionItem, Post } from '../../database/entities';
import { PostsModule } from '../posts/posts.module';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Collection, CollectionItem, Post, Article]),
    PostsModule, // 复用 PostsService.serializePost 渲染收录的动态
  ],
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
