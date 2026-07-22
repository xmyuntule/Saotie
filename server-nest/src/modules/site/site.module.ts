import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficialPage, Post, SiteConfig, Topic, User } from '../../database/entities';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteConfig, OfficialPage, Topic, User, Post])],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService], // admin / sensitive 等模块后续会复用配置读写
})
export class SiteModule {}
