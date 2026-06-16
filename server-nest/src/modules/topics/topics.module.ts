import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post, Topic, TopicFollow } from '../../database/entities';
import { PostsModule } from '../posts/posts.module';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Topic, TopicFollow, Post]),
    PostsModule,
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
})
export class TopicsModule {}
