// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { OnlineUsersService } from './usersOnline.service';
import { UserRepository } from './user.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  providers: [UsersService, OnlineUsersService, UserRepository, PrismaService],
  exports: [UsersService, OnlineUsersService, UserRepository],
})
export class UsersModule {}
