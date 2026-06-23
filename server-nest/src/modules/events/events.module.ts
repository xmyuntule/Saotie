import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event, EventSignup, User } from '../../database/entities';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventSignup, User])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
