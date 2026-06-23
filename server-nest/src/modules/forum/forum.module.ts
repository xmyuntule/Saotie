import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Board,
  BoardFollow,
  Like,
  Moderator,
  Thread,
  ThreadSub,
  User,
} from '../../database/entities';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Board,
      BoardFollow,
      Moderator,
      Thread,
      Like,
      ThreadSub,
      User,
    ]),
  ],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
