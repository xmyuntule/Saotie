import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteNotice } from '../../database/entities';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteNotice])],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
