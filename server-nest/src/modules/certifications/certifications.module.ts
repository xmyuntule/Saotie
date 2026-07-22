import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CertificationApplication,
  Post,
  SiteConfig,
  Topic,
  User,
} from '../../database/entities';
import {
  AdminCertificationsController,
  CertificationsController,
} from './certifications.controller';
import { CertificationsService } from './certifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([CertificationApplication, User, Post, Topic, SiteConfig])],
  controllers: [CertificationsController, AdminCertificationsController],
  providers: [CertificationsService],
})
export class CertificationsModule {}
