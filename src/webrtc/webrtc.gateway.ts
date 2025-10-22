// src/webrtc/webrtc.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnlineUsersService } from '../users/usersOnline.service';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';

@WebSocketGateway({
  namespace: '/webrtc',
  cors: { origin: true },
})
export class WebRtcGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRtcGateway.name);
  private activeCalls = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private onlineUsersService: OnlineUsersService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`🔌 WebRTC Client connecting: ${client.id}`);

      const token = client.handshake.auth.token as string;
      if (!token) {
        this.logger.warn('❌ No token provided for WebRTC connection');
        client.disconnect();
        return;
      }
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET is not configured');
        client.disconnect();
        return;
      }

      // احراز هویت کاربر
      const payload: JwtPayload = this.jwtService.verify(token, { secret });
      this.logger.log(`✅ WebRTC User ${payload.username} connected`);
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
    } catch (error) {
      this.logger.error('❌ WebRTC Connection error:', error);
      client.disconnect();
    }
  }

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

  // 📞 کاربر میخواد تماس بگیره
  @SubscribeMessage('call_user')
  handleCallUser(
    @ConnectedSocket() caller: Socket,
    @MessageBody()
    data: {
      to: string;
      offer: RTCSessionDescriptionInit;
      from: string;
      fromUsername: string;
    },
  ) {
    this.logger.log(`📞 User ${data.fromUsername} calling ${data.to}`);

    // پیدا کردن کاربر مقصد
    const targetUser = this.onlineUsersService.getUserByUserId(data.to);
    // دیباگ: چک کردن همه کاربران آنلاین
    const allOnlineUsers = this.onlineUsersService.getAllOnlineUsers();
    this.logger.log('👥 All online users:', allOnlineUsers);

    if (!targetUser) {
      // اگر کاربر مقصد آنلاین نیست
      this.logger.warn(`❌ Target user ${data.to} not found or offline`);
      caller.emit('call_failed', {
        message: 'User is not online',
      });
      return;
    }

    this.logger.log(
      `✅ Found target user: ${targetUser.username} with socket: ${targetUser.socketId}`,
    );

    // ذخیره اطلاعات تماس
    this.activeCalls.set(data.from, data.to);

    // فرستادن درخواست تماس به کاربر مقصد
    this.server.to(targetUser.socketId).emit('incoming_call', {
      from: data.from,
      fromUsername: data.fromUsername,
      offer: data.offer,
    });

    this.logger.log(`📞 Call request sent to user ${data.to}`);
  }

  // ✅ کاربر مقصد تماس رو قبول میکنه
  @SubscribeMessage('accept_call')
  handleAcceptCall(
    @ConnectedSocket() callee: Socket,
    @MessageBody()
    data: {
      to: string;
      answer: RTCSessionDescriptionInit;
    },
  ) {
    this.logger.log(`✅ User accepting call from ${data.to}`);

    const callerUser = this.onlineUsersService.getUserByUserId(data.to);

    if (!callerUser) {
      this.logger.warn(`❌ Caller ${data.to} not found`);
      callee.emit('call_failed', { message: 'Caller not found' });
      return;
    }

    this.server.to(callerUser.socketId).emit('call_accepted', {
      answer: data.answer,
    });

    this.logger.log(`✅ Call acceptance sent to ${data.to}`);
  }

  // ❌ کاربر تماس رو رد میکنه
  @SubscribeMessage('reject_call')
  handleRejectCall(
    @ConnectedSocket() callee: Socket,
    @MessageBody() data: { to: string },
  ) {
    this.logger.log(`❌ User rejecting call from ${data.to}`);

    const callerUser = this.onlineUsersService.getUserByUserId(data.to);

    if (callerUser) {
      this.server.to(callerUser.socketId).emit('call_rejected');
      this.logger.log(`❌ Call rejection sent to ${data.to}`);
    }
  }

  // 📡 ارسال اطلاعات شبکه
  @SubscribeMessage('ice_candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      to: string;
      candidate: RTCIceCandidateInit;
    },
  ) {
    const targetUser = this.onlineUsersService.getUserByUserId(data.to);

    if (targetUser) {
      this.server.to(targetUser.socketId).emit('ice_candidate', {
        candidate: data.candidate,
      });
    }
  }

  // 🚪 قطع کردن تماس
  @SubscribeMessage('end_call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string },
  ) {
    this.logger.log(`🚪 User ending call with ${data.to}`);

    const targetUser = this.onlineUsersService.getUserByUserId(data.to);

    if (targetUser) {
      this.server.to(targetUser.socketId).emit('call_ended');
      this.logger.log(`🚪 Call end notification sent to ${data.to}`);
    }

    // حذف از لیست تماس‌های فعال
    this.activeCalls.delete(data.to);
    this.activeCalls.forEach((value, key) => {
      if (value === data.to) {
        this.activeCalls.delete(key);
      }
    });
  }
}
