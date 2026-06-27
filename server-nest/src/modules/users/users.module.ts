import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Follow, User, ViewHistory } from '../../database/entities';
import { PostsModule } from '../posts/posts.module';
import { SiteModule } from '../site/site.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Follow, Block, ViewHistory]),
    // for serializePost on /me/bookmarks
    PostsModule,
    // for demo_recharge_enabled gate in recharge()
    SiteModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
