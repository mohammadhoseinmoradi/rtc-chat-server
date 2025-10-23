// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { MessageRepository } from './chat.repository';
@Injectable()
export class ChatService {
  constructor(private messageRepository: MessageRepository) {}

  // ذخیره پیام در دیتابیس
  async saveMessage(
    content: string,
    senderId: string,
    receiverId?: string,
    type: 'PRIVATE' | 'GROUP' = 'PRIVATE',
  ): Promise<any> {
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
    type: 'PRIVATE' | 'GROUP' = 'PRIVATE',
  ): Promise<any[]> {
    if (type === 'PRIVATE' && otherUserId) {
      return this.messageRepository.getPrivateChatHistory(userId, otherUserId);
    } else {
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
