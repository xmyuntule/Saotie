import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinLog, User } from '../../database/entities';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({
  imports: [TypeOrmModule.forFeature([CheckinLog, User])],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
