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
import { CallLoggerService } from './webrtc.callLogger.service';

interface ActiveCall {
  callId: string;
  caller_id: string;
  caller_username: string;
  callee_id: string;
  callee_username: string;
  status: 'INITIATED' | 'ACCEPTED' | 'REJECTED' | 'ENDED';
  startTime: number;
  acceptTime?: number; // زمان قبول تماس
  endTime?: number; // زمان پایان تماس
}
@WebSocketGateway({
  namespace: '/webrtc',
  cors: { origin: true },
})
export class WebRtcGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRtcGateway.name);
  private activeCalls = new Map<string, ActiveCall>();
  private callStartTimes = new Map<string, number>();
  constructor(
    private jwtService: JwtService,
    private onlineUsersService: OnlineUsersService,
    private configService: ConfigService,
    private usersService: UsersService,
    private callLoggerService: CallLoggerService,
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
  async handleCallUser(
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
    // ایجاد ID یکتا برای تماس
    const callId = `${data.from}-${data.to}-${Date.now()}`;

    // ذخیره اطلاعات تماس
    this.activeCalls.set(callId, {
      callId,
      caller_id: data.from,
      caller_username: data.fromUsername,
      callee_id: data.to,
      callee_username: targetUser.username,
      status: 'INITIATED',
      startTime: Date.now(),
    });
    await this.callLoggerService.logCallInitiated({
      callId,
      caller_id: data.from,
      caller_username: data.fromUsername,
      callee_id: data.to,
      callee_username: targetUser.username,
    });

    // فرستادن درخواست تماس به کاربر مقصد
    this.server.to(targetUser.socketId).emit('incoming_call', {
      from: data.from,
      fromUsername: data.fromUsername,
      offer: data.offer,
    });

    this.callStartTimes.set(callId, Date.now());

    this.logger.log(
      `✅ Found target user: ${targetUser.username} with socket: ${targetUser.socketId}`,
    );
    this.server.to(targetUser.socketId).emit('incoming_call', {
      from: data.from,
      fromUsername: data.fromUsername,
      offer: data.offer,
      callId: callId,
    });

    this.logger.log(`📞 Call request sent to user ${data.to}`);
  }

  // ✅ کاربر مقصد تماس رو قبول میکنه
  @SubscribeMessage('accept_call')
  async handleAcceptCall(
    @ConnectedSocket() callee: Socket,
    @MessageBody()
    data: {
      to: string;
      answer: RTCSessionDescriptionInit;
      callId: string;
    },
  ) {
    this.logger.log(`✅ User accepting call from ${data.to}`);

    const callerUser = this.onlineUsersService.getUserByUserId(data.to);
    const calleeUser = this.onlineUsersService.getUserBySocketId(callee.id);

    if (!callerUser || !calleeUser) {
      this.logger.warn(`❌ Caller ${data.to} not found`);
      callee.emit('call_failed', { message: 'Caller not found' });
      return;
    }
    const callInfo = this.activeCalls.get(data.callId);
    if (callInfo) {
      callInfo.status = 'ACCEPTED';
      callInfo.acceptTime = Date.now();
      this.activeCalls.set(data.callId, callInfo);
    }
    await this.callLoggerService.logAcceptedCall({
      callId: data.callId,
      caller_id: data.to,
      caller_username: callerUser.username,
      callee_id: calleeUser.userId,
      callee_username: calleeUser.username,
    });

    this.server.to(callerUser.socketId).emit('call_accepted', {
      answer: data.answer,
    });

    this.logger.log(`✅ Call acceptance sent to ${data.to}`);
  }

  // ❌ کاربر تماس رو رد میکنه
  @SubscribeMessage('reject_call')
  async handleRejectCall(
    @ConnectedSocket() callee: Socket,
    @MessageBody() data: { to: string; callId: string; reason?: string },
  ) {
    this.logger.log(
      `❌ User rejecting call from ${data.to}, Call ID: ${data.callId}`,
    );

    const callerUser = this.onlineUsersService.getUserByUserId(data.to);
    const calleeUser = this.onlineUsersService.getUserBySocketId(callee.id);
    if (!callerUser || !calleeUser) {
      this.logger.warn(`❌ Caller ${data.to} or callee not found`);
      callee.emit('call_failed', {
        message: !callerUser
          ? 'Caller not found'
          : 'Your user information not found',
      });
      return;
    }
    if (callerUser) {
      const callInfo = this.activeCalls.get(data.callId);

      // لاگ کردن رد تماس - به لاگر ۲
      await this.callLoggerService.logRejectedCall({
        callId: data.callId,
        caller_id: data.to,
        caller_username: callerUser.username,
        callee_id: calleeUser.userId,
        callee_username: calleeUser.username,
        reason: data.reason || 'User rejected the call',
      });

      // آپدیت وضعیت تماس
      if (callInfo) {
        callInfo.status = 'REJECTED';
        callInfo.endTime = Date.now();
      }

      this.server.to(callerUser.socketId).emit('call_rejected', {
        callId: data.callId,
        reason: data.reason,
      });

      // حذف از لیست تماس‌های فعال بعد از چند ثانیه
      setTimeout(() => {
        this.activeCalls.delete(data.callId);
        this.callStartTimes.delete(data.callId);
      }, 5000); // 5 ثانیه تاخیر برای دیباگ

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
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; callId: string; reason?: string },
  ) {
    this.logger.log(
      `🚪 User ending call with ${data.to}, Call ID: ${data.callId}`,
    );

    const targetUser = this.onlineUsersService.getUserByUserId(data.to);
    if (targetUser) {
      this.server.to(targetUser.socketId).emit('call_ended', {
        callId: data.callId,
        reason: data.reason,
      });
    }

    // 🔥 محاسبه مدت تماس - حالا callInfo نوع درست داره
    const callInfo = this.activeCalls.get(data.callId);
    let duration = '0';

    if (callInfo) {
      const startTime = this.callStartTimes.get(data.callId);

      // چک کردن وجود startTime
      if (startTime) {
        duration = ((Date.now() - startTime) / 1000).toFixed(2);
      }

      // آپدیت وضعیت تماس
      callInfo.status = 'ENDED';
      callInfo.endTime = Date.now();
    }

    // لاگ کردن پایان تماس
    if (callInfo) {
      await this.callLoggerService.logCallEnded({
        callId: data.callId,
        caller_id: callInfo.caller_id,
        caller_username: callInfo.caller_username,
        callee_id: callInfo.callee_id,
        callee_username: callInfo.callee_username,
        duration: duration,
        reason: data.reason || 'Call ended by user',
        wasAccepted: callInfo.status === 'ACCEPTED',
      });
    }

    // حذف از لیست تماس‌های فعال بعد از چند ثانیه
    setTimeout(() => {
      this.activeCalls.delete(data.callId);
      this.callStartTimes.delete(data.callId);
      this.logger.log(`🧹 Call ${data.callId} cleaned up from memory`);
    }, 3000);

    this.logger.log(`🚪 Call end notification sent to ${data.to}`);
  }
}
