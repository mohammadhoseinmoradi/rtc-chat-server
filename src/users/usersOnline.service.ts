// src/users/online-users.service.ts
import { Injectable } from '@nestjs/common';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

@Injectable()
export class OnlineUsersService {
  private onlineUsers = new Map<string, OnlineUser>();

  addUser(socketId: string, userInfo: { userId: string; username: string }) {
    this.onlineUsers.set(socketId, {
      ...userInfo,
      socketId,
    });
  }

  removeUser(socketId: string) {
    this.onlineUsers.delete(socketId);
  }

  getUserBySocketId(socketId: string): OnlineUser | undefined {
    return this.onlineUsers.get(socketId);
  }

  getUserByUserId(userId: string): OnlineUser | undefined {
    return Array.from(this.onlineUsers.values()).find(
      (user) => user.userId === userId,
    );
  }

  getAllOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsers.values());
  }

  getOnlineUsersCount(): number {
    return this.onlineUsers.size;
  }
}
