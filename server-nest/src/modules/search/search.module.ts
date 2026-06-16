import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post, Thread, Topic, User } from '../../database/entities';
import { PostsModule } from '../posts/posts.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Post, Thread, Topic]),
    PostsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
