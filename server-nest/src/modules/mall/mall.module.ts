import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, Product, User } from '../../database/entities';
import { MallController } from './mall.controller';
import { MallService } from './mall.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Order, User])],
  controllers: [MallController],
  providers: [MallService],
})
export class MallModule {}
