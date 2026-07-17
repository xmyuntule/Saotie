import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Board,
  BoardFollow,
  BoardPurchase,
  Like,
  Moderator,
  Thread,
  ThreadSub,
  User,
} from '../../database/entities';
import { ForumController } from './forum.controller';
import { ForumPermissionService } from './forum-permission.service';
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
      BoardPurchase,
      User,
    ]),
  ],
  controllers: [ForumController],
  providers: [ForumService, ForumPermissionService],
})
export class ForumModule {}
