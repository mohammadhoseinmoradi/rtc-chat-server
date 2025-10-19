// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { Message } from './entities/message.entity';
import { User } from '../users/user.entity';
import { OnlineUsersService } from '../users/usersOnline.service';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message, User]), JwtModule, UsersModule],
  providers: [ChatGateway, ChatService, OnlineUsersService, UsersService],
  exports: [ChatService],
})
export class ChatModule {}
