import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment, Like, Post, Thread, User } from '../../database/entities';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Like, Post, Thread, User])],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
