import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Answer,
  Circle,
  Comment,
  Follow,
  Like,
  PollVote,
  Post,
  TaskClaim,
  User,
  UserBadge,
} from '../../database/entities';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Comment,
      Like,
      PollVote,
      Follow,
      Answer,
      Circle,
      UserBadge,
      TaskClaim,
    ]),
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService],
})
export class AchievementsModule {}
