import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Circle, CircleMember, CircleMessage, Post } from '../../database/entities';
import { PostsModule } from '../posts/posts.module';
import { CirclesController } from './circles.controller';
import { CirclesService } from './circles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Circle, CircleMember, CircleMessage, Post]),
    PostsModule,
  ],
  controllers: [CirclesController],
  providers: [CirclesService],
})
export class CirclesModule {}
