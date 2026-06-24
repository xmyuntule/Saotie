import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinLog, Order, Product, User } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SiteModule } from '../site/site.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Product, Order, CheckinLog]), SiteModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
