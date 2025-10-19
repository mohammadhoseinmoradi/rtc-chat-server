import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { OnlineUsersService } from './usersOnline.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],

  providers: [UsersService, OnlineUsersService],
  exports: [UsersService, TypeOrmModule, OnlineUsersService],
})
export class UsersModule {}
