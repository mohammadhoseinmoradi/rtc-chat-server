// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async register(userData: {
    email: string;
    username: string;
    password: string;
  }) {
    // بررسی وجود کاربر
    const existingUser = await this.usersService.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // هش کردن رمز عبور
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // ایجاد کاربر جدید
    const user = await this.usersService.create({
      ...userData,
      password: hashedPassword,
    });

    // تولید توکن
    return this.generateToken(user);
  }

  async login(credentials: { email: string; password: string }) {
    // پیدا کردن کاربر
    const user = await this.usersService.findByEmail(credentials.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // بررسی رمز عبور
    const isPasswordValid = await bcrypt.compare(
      credentials.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  private generateToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    return await this.usersService.findById(payload.sub);
  }
}
