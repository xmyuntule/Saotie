import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article, Comment, Like, Post, Thread, ThreadSub, User } from '../../database/entities';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Like, Post, Thread, ThreadSub, Article, User])],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
