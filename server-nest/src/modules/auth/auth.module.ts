import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinLog, Order, Product, User } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Product, Order, CheckinLog])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
