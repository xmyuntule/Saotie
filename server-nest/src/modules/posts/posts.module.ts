import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Block,
  Bookmark,
  Like,
  Order,
  Poll,
  PollOption,
  PollVote,
  Post,
  Product,
  Purchase,
  RedPacket,
  RedPacketGrab,
  Reward,
  Topic,
  TopicFollow,
  User,
} from '../../database/entities';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      User,
      Like,
      Bookmark,
      Block,
      Topic,
      TopicFollow,
      Purchase,
      Reward,
      Poll,
      PollOption,
      PollVote,
      Product,
      Order,
      RedPacket,
      RedPacketGrab,
    ]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  // exported so UsersModule can reuse serializePost / bookmarkedPosts
  exports: [PostsService],
})
export class PostsModule {}
