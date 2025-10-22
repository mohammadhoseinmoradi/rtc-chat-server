/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/chat/message.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Message } from '../../generated/prisma';
import { MessageType } from '@prisma/client';

@Injectable()
export class MessageRepository {
  constructor(private prisma: PrismaService) {}

  async createMessage(data: {
    content: string;
    senderId: string;
    receiverId?: string;
    type?: 'private' | 'group';
  }): Promise<Message> {
    const messageType =
      (data.type?.toUpperCase() as MessageType) || MessageType.PRIVATE;
    return await this.prisma.message.create({
      data: {
        content: data.content,
        senderId: data.senderId,
        receiverId: data.receiverId,
        type: messageType,
      },
      include: {
        sender: true,
      },
    });
  }

  async getPrivateChatHistory(
    userId: string,
    otherUserId: string,
  ): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: userId,
            receiverId: otherUserId,
            type: MessageType.PRIVATE,
          },
          {
            senderId: otherUserId,
            receiverId: userId,
            type: MessageType.PRIVATE,
          },
        ],
      },
      include: {
        sender: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async getGroupMessages(): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: {
        type: MessageType.GROUP,
      },
      include: {
        sender: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async markAsRead(messageId: string): Promise<Message> {
    return await this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }
}
