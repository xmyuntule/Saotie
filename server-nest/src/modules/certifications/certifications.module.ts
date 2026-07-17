import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificationApplication, User } from '../../database/entities';
import {
  AdminCertificationsController,
  CertificationsController,
} from './certifications.controller';
import { CertificationsService } from './certifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([CertificationApplication, User])],
  controllers: [CertificationsController, AdminCertificationsController],
  providers: [CertificationsService],
})
export class CertificationsModule {}
