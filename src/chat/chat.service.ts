// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ذخیره پیام در دیتابیس
  async saveMessage(
    content: string,
    senderId: string,
    receiverId?: string,
    type: 'private' | 'group' = 'private',
  ): Promise<Message> {
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
    });

    if (!sender) {
      throw new Error('Sender not found');
    }

    const message = this.messageRepository.create({
      content,
      sender,
      senderId,
      receiverId,
      type,
    });

    return await this.messageRepository.save(message);
  }

  // دریافت تاریخچه چت
  async getChatHistory(
    userId: string,
    otherUserId?: string,
    type: 'private' | 'group' = 'private',
  ): Promise<Message[]> {
    if (type === 'private' && otherUserId) {
      // پیام‌های خصوصی بین دو کاربر
      return await this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .where(
          '(message.senderId = :userId AND message.receiverId = :otherUserId) OR (message.senderId = :otherUserId AND message.receiverId = :userId)',
          { userId, otherUserId },
        )
        .orderBy('message.timestamp', 'ASC')
        .getMany();
    } else {
      // پیام‌های گروهی
      return await this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .where('message.type = :type', { type: 'group' })
        .orderBy('message.timestamp', 'ASC')
        .getMany();
    }
  }

  // علامت گذاری پیام به عنوان خوانده شده
  async markAsRead(messageId: string): Promise<void> {
    await this.messageRepository.update(messageId, { isRead: true });
  }

  // تعداد پیام‌های خوانده نشده
  async getUnreadCount(userId: string): Promise<number> {
    return await this.messageRepository.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }
}
