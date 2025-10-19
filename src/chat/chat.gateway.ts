// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, UseFilters } from '@nestjs/common';
import { ChatService } from './chat.service';
import { OnlineUsersService } from '../users/usersOnline.service';
import { UsersService } from '../users/users.service';
import { SendMessageDto } from './dtos/send-message.dto';
import { WebSocketExceptionFilter } from '../common/filters/websoket-exception.filter';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
@UseFilters(new WebSocketExceptionFilter())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private onlineUsersService: OnlineUsersService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  // وقتی کاربر وصل می‌شه
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connecting: ${client.id}`);

      // احراز هویت کاربر از طریق توکن
      const token = client.handshake.auth.token as string;
      if (!token) {
        this.logger.warn('No token provided');
        client.disconnect();
        return;
      }
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET is not configured');
        client.disconnect();
        return;
      }

      const payload: JwtPayload = this.jwtService.verify(token, { secret });
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        this.logger.warn('User not found');
        client.disconnect();
        return;
      }

      // آپدیت وضعیت کاربر به آنلاین
      await this.usersService.updateUserStatus(user.id, true);

      // اضافه کردن کاربر به لیست آنلاین‌ها
      this.onlineUsersService.addUser(client.id, {
        userId: user.id,
        username: user.username,
      });

      this.logger.log(
        `User ${user.username} connected with socket ${client.id}`,
      );

      // اطلاع به همه کاربران
      this.server.emit('user_connected', {
        userId: user.id,
        username: user.username,
        onlineUsers: this.onlineUsersService.getAllOnlineUsers(),
      });

      // ارسال لیست کاربران آنلاین به کاربر جدید
      client.emit('online_users', this.onlineUsersService.getAllOnlineUsers());

      this.logger.log(
        `Total online users: ${this.onlineUsersService.getOnlineUsersCount()}`,
      );
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  // وقتی کاربر قطع می‌شه
  async handleDisconnect(client: Socket) {
    try {
      const userInfo = this.onlineUsersService.getUserBySocketId(client.id);

      if (userInfo) {
        // آپدیت وضعیت کاربر به آفلاین
        await this.usersService.updateUserStatus(userInfo.userId, false);

        // حذف از لیست آنلاین‌ها
        this.onlineUsersService.removeUser(client.id);

        this.logger.log(`User ${userInfo.username} disconnected`);

        // اطلاع به همه کاربران
        this.server.emit('user_disconnected', {
          userId: userInfo.userId,
          username: userInfo.username,
          onlineUsers: this.onlineUsersService.getAllOnlineUsers(),
        });
      }

      this.logger.log(`Client disconnected: ${client.id}`);
      this.logger.log(
        `Total online users: ${this.onlineUsersService.getOnlineUsersCount()}`,
      );
    } catch (error) {
      this.logger.error('Disconnection error:', error);
    }
  }

  // ارسال پیام
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    try {
      const senderInfo = this.onlineUsersService.getUserBySocketId(client.id);
      if (!senderInfo) {
        throw new Error('User not found');
      }

      this.logger.log(`Message from ${senderInfo.username}: ${data.content}`);

      console.log(
        '📤 Sending message from:',
        senderInfo.username,
        'to:',
        data.receiverId,
      );

      const savedMessage = await this.chatService.saveMessage(
        data.content,
        senderInfo.userId,
        data.receiverId,
        data.type || 'private',
      );

      // ساخت object پیام برای ارسال
      const messageToSend = {
        id: savedMessage.id,
        content: savedMessage.content,
        sender: {
          id: senderInfo.userId,
          username: senderInfo.username,
        },
        receiverId: savedMessage.receiverId,
        type: savedMessage.type,
        timestamp: savedMessage.timestamp,
        isRead: savedMessage.isRead,
      };

      console.log('📤 Message to send:', messageToSend);

      // ارسال پیام بر اساس نوع
      if (data.type === 'group') {
        // ارسال به همه کاربران
        this.server.emit('new_message', messageToSend);
        console.log('📤 Sent to all (group)');
      } else {
        // پیام خصوصی
        if (data.receiverId) {
          const receiverSocket = this.findSocketIdByUserId(data.receiverId);
          console.log('📤 Receiver socket ID:', receiverSocket);

          if (receiverSocket) {
            // ارسال به گیرنده
            this.server.to(receiverSocket).emit('new_message', messageToSend);
            console.log('📤 Sent to receiver');
          }

          // ارسال به خود فرستنده (برای sync شدن)
          client.emit('new_message', messageToSend);
          console.log('📤 Sent to sender');
        }
      }

      return { success: true, message: messageToSend };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw error;
    }
  }

  // دریافت تاریخچه چت
  @SubscribeMessage('get_chat_history')
  async handleGetChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { otherUserId?: string; type?: 'private' | 'group' },
  ) {
    try {
      const userInfo = this.onlineUsersService.getUserBySocketId(client.id);
      if (!userInfo) {
        throw new Error('User not found');
      }

      const messages = await this.chatService.getChatHistory(
        userInfo.userId,
        data.otherUserId,
        data.type || 'private',
      );
      console.log('message of history', messages);
      // تبدیل به فرمت مناسب برای کلاینت
      const formattedMessages = messages.map((message) => ({
        id: message.id,
        content: message.content,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
        },
        receiverId: message.receiverId,
        type: message.type,
        timestamp: message.timestamp,
        isRead: message.isRead,
      }));

      client.emit('chat_history', formattedMessages);
    } catch (error) {
      this.logger.error('Error getting chat history:', error);
      throw error;
    }
  }

  // تایید دریافت پیام (خوانده شده)
  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      await this.chatService.markAsRead(data.messageId);
      client.emit('message_marked_read', { messageId: data.messageId });
    } catch (error) {
      this.logger.error('Error marking message as read:', error);
    }
  }

  // تایپ کردن...
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId?: string },
  ) {
    const userInfo = this.onlineUsersService.getUserBySocketId(client.id);
    if (!userInfo) return;

    if (data.receiverId) {
      const receiverSocket = this.findSocketIdByUserId(data.receiverId);
      if (receiverSocket) {
        this.server.to(receiverSocket).emit('user_typing', {
          userId: userInfo.userId,
          username: userInfo.username,
        });
      }
    }
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId?: string },
  ) {
    const userInfo = this.onlineUsersService.getUserBySocketId(client.id);
    if (!userInfo) return;

    if (data.receiverId) {
      const receiverSocket = this.findSocketIdByUserId(data.receiverId);
      if (receiverSocket) {
        this.server.to(receiverSocket).emit('user_stopped_typing', {
          userId: userInfo.userId,
        });
      }
    }
  }

  // پیدا کردن socketId کاربر با userId
  private findSocketIdByUserId(userId: string): string | null {
    const user = this.onlineUsersService.getUserByUserId(userId);
    return user ? user.socketId : null;
  }
}
