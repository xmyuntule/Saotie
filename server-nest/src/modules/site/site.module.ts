import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteConfig } from '../../database/entities';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteConfig])],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService], // admin / sensitive 等模块后续会复用配置读写
})
export class SiteModule {}
