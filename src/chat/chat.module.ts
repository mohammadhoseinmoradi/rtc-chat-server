// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageRepository } from './chat.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OnlineUsersService } from '../users/usersOnline.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from 'src/users/user.repository';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  providers: [
    ChatGateway,
    ChatService,
    MessageRepository,
    PrismaService,
    UsersService,
    OnlineUsersService,
    JwtService,
    UserRepository,
    ConfigService,
  ],
})
export class ChatModule {}
