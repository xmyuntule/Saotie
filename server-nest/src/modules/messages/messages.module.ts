import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, ConversationSetting, Message, User } from '../../database/entities';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message, ConversationSetting, User, Block])],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
