import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Board,
  Comment,
  Moderator,
  Post,
  Product,
  Report,
  Thread,
  Topic,
  User,
} from '../../database/entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Thread,
      Comment,
      Topic,
      Board,
      Moderator,
      Report,
      Product,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
