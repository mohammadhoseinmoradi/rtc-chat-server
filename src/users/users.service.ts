// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return await this.usersRepository.save(user);
  }

  async updateUserStatus(userId: string, isOnline: boolean): Promise<void> {
    if (isOnline) {
      await this.usersRepository
        .createQueryBuilder()
        .update(User)
        .set({
          isOnline: true,
          lastSeen: () => 'NULL', // استفاده از NULL در دیتابیس
        })
        .where('id = :id', { id: userId })
        .execute();
    } else {
      await this.usersRepository
        .createQueryBuilder()
        .update(User)
        .set({
          isOnline: false,
          lastSeen: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :id', { id: userId })
        .execute();
    }
  }
}
