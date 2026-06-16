import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flash } from '../../database/entities';
import { FlashController } from './flash.controller';
import { FlashService } from './flash.service';

@Module({
  imports: [TypeOrmModule.forFeature([Flash])],
  controllers: [FlashController],
  providers: [FlashService],
})
export class FlashModule {}
