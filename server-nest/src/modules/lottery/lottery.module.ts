import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotteryDraw, LotteryPrize, User } from '../../database/entities';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';

@Module({
  imports: [TypeOrmModule.forFeature([LotteryPrize, LotteryDraw, User])],
  controllers: [LotteryController],
  providers: [LotteryService],
})
export class LotteryModule {}
