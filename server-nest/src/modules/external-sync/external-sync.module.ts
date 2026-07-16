import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Board,
  ExternalSyncImport,
  ExternalSyncSource,
  Post,
  Thread,
  Topic,
  User,
} from '../../database/entities';
import { SiteModule } from '../site/site.module';
import { ExternalSyncController } from './external-sync.controller';
import { ExternalSyncService } from './external-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExternalSyncSource,
      ExternalSyncImport,
      User,
      Board,
      Thread,
      Post,
      Topic,
    ]),
    SiteModule,
  ],
  controllers: [ExternalSyncController],
  providers: [ExternalSyncService],
})
export class ExternalSyncModule {}
