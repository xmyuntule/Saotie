import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationSetting, Message, User } from '../../database/entities';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message, ConversationSetting, User])],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
