// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { users } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private userRepository: UserRepository) {}

  async findByEmail(email: string): Promise<users | null> {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<users | null> {
    return this.userRepository.findById(id);
  }

  async create(userData: {
    email: string;
    username: string;
    password: string;
  }): Promise<users> {
    return this.userRepository.createUser(userData);
  }

  async updateUserStatus(userId: string, isOnline: boolean): Promise<users> {
    return this.userRepository.updateUserStatus(userId, isOnline);
  }
}
