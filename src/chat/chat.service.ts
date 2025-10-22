// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { MessageRepository } from './chat.repository';
import { Message } from '../../generated/prisma';

@Injectable()
export class ChatService {
  constructor(private messageRepository: MessageRepository) {}

  // ذخیره پیام در دیتابیس
  async saveMessage(
    content: string,
    senderId: string,
    receiverId?: string,
    type: 'private' | 'group' = 'private',
  ): Promise<Message> {
    return this.messageRepository.createMessage({
      content,
      senderId,
      receiverId,
      type,
    });
  }

  // دریافت تاریخچه چت
  async getChatHistory(
    userId: string,
    otherUserId?: string,
    type: 'private' | 'group' = 'private',
  ): Promise<Message[]> {
    if (type === 'private' && otherUserId) {
      // پیام‌های خصوصی بین دو کاربر
      return this.messageRepository.getPrivateChatHistory(userId, otherUserId);
    } else {
      // پیام‌های گروهی
      return this.messageRepository.getGroupMessages();
    }
  }

  // علامت گذاری پیام به عنوان خوانده شده
  async markAsRead(messageId: string): Promise<void> {
    await this.messageRepository.markAsRead(messageId);
  }

  // تعداد پیام‌های خوانده نشده
  async getUnreadCount(userId: string): Promise<number> {
    return this.messageRepository.getUnreadCount(userId);
  }
}
