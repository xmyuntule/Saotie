import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrder, User } from '../../database/entities';
import { SiteModule } from '../site/site.module';
import { PayController } from './pay.controller';
import { PayService } from './pay.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentOrder, User]), SiteModule],
  controllers: [PayController],
  providers: [PayService],
})
export class PayModule {}
