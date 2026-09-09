import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinLog, PasswordResetToken, User } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SiteModule } from '../site/site.module';
import { EmailService } from './email.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, CheckinLog, PasswordResetToken]), SiteModule],
  controllers: [AuthController],
  providers: [AuthService, EmailService],
  exports: [AuthService, EmailService],
})
export class AuthModule {}
