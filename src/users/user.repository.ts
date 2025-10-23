/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
// src/users/user.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { users, Prisma } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<users | null> {
    return this.prisma.users.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<users | null> {
    return this.prisma.users.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    email: string;
    username: string;
    password: string;
  }): Promise<users> {
    return this.prisma.users.create({
      data: {
        email: data.email,
        username: data.username,
        password: data.password,
      } as Prisma.usersUncheckedCreateInput,
    });
  }

  async updateUserStatus(userId: string, isOnline: boolean): Promise<users> {
    if (isOnline) {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          isOnline: true,
          lastSeen: null,
        },
      });
    } else {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          isOnline: false,
          lastSeen: new Date(),
        },
      });
    }
  }

  async updateUser(
    userId: string,
    data: Prisma.usersUpdateInput,
  ): Promise<users> {
    return this.prisma.users.update({
      where: { id: userId },
      data,
    });
  }
}
