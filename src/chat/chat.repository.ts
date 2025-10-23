/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/chat/message.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { messages } from '@prisma/client';

@Injectable()
export class MessageRepository {
  constructor(private prisma: PrismaService) {}

  async createMessage(data: {
    content: string;
    senderId: string;
    receiverId?: string;
    type?: 'PRIVATE' | 'GROUP';
  }): Promise<any> {
    return this.prisma.messages.create({
      data: {
        id: '',
        content: data.content,
        senderId: data.senderId,
        receiverId: data.receiverId,
        type: data.type || 'PRIVATE',
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async getPrivateChatHistory(
    userId: string,
    otherUserId: string,
  ): Promise<any[]> {
    return this.prisma.messages.findMany({
      where: {
        OR: [
          {
            senderId: userId,
            receiverId: otherUserId,
            type: 'PRIVATE',
          },
          {
            senderId: otherUserId,
            receiverId: userId,
            type: 'PRIVATE',
          },
        ],
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async getGroupMessages(): Promise<any[]> {
    return this.prisma.messages.findMany({
      where: {
        type: 'GROUP',
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async markAsRead(messageId: string): Promise<messages> {
    return await this.prisma.messages.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.messages.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }
}
