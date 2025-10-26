/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { join } from 'path';

interface LogService {
  LogCall(data: any): any;
}

@Injectable()
export class CallLoggerService implements OnModuleInit {
  private rejectedCall: LogService;
  private acceptedCall: LogService;

  constructor() {
    const rejectedCallClient = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'logs',
        protoPath: join(__dirname, '../../../logs.proto'),
        url: 'localhost:5001',
      },
    });

    const acceptedCallClient = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'logs',
        protoPath: join(__dirname, '../../../logs.proto'),
        url: 'localhost:5002',
      },
    });

    this.rejectedCall = rejectedCallClient.getService<LogService>('LogService');
    this.acceptedCall = acceptedCallClient.getService<LogService>('LogService');
  }

  onModuleInit() {
    console.log('✅ CallLoggerService ready for WebRTC logging!');
  }

  async logAcceptedCall(callData: any) {
    try {
      const logData = {
        call_id:
          callData.callId ||
          `${callData.caller_id}-${callData.callee_id}-${Date.now()}`,
        caller_id: callData.caller_id,
        caller_username: callData.caller_username,
        callee_id: callData.callee_id,
        callee_username: callData.callee_username,
        action: 'CALL_ACCEPTED',
        timestamp: new Date().toISOString(),
        duration: '0',
        reason: 'Call accepted by user',
      };

      const result = await this.acceptedCall.LogCall(logData).toPromise();
      console.log('🟢 Accepted call logged to AcceptedCall:', result);
      return result;
    } catch (error) {
      console.error(
        '🔴 Error logging accepted call:',
        error instanceof Error ? error.message : String(error),
      );
      await this.logRejectedCall({
        ...callData,
        reason: 'accepted-call unavailable - fallback',
      });
    }
  }

  async logRejectedCall(callData: any) {
    try {
      const logData = {
        call_id:
          callData.callId ||
          `${callData.caller_id}-${callData.callee_id}-${Date.now()}`,
        caller_id: callData.caller_id,
        caller_username: callData.caller_username,
        callee_id: callData.callee_id,
        callee_username: callData.callee_username,
        action: 'CALL_REJECTED',
        timestamp: new Date().toISOString(),
        duration: '0',
        reason: callData.reason || 'Call rejected by user',
      };

      const result = await this.rejectedCall.LogCall(logData).toPromise();
      console.log('🔵 Rejected call logged to rejectedCall:', result);
      return result;
    } catch (error) {
      console.error(
        '🔴 Error logging rejected call:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // لاگ کردن شروع تماس
  async logCallInitiated(callData: any) {
    try {
      const logData = {
        call_id:
          callData.callId ||
          `${callData.caller_id}-${callData.callee_id}-${Date.now()}`,
        caller_id: callData.caller_id,
        caller_username: callData.caller_username,
        callee_id: callData.callee_id,
        callee_username: callData.callee_username,
        action: 'CALL_INITIATED',
        timestamp: new Date().toISOString(),
        duration: '0',
        reason: 'Call initiated',
      };
      const [result1, result2] = await Promise.all([
        this.rejectedCall.LogCall(logData).toPromise(),
        this.rejectedCall.LogCall(logData).toPromise(),
      ]);

      console.log('📞 Call initiated logged to both loggers');
      return { rejectedCall: result1, accepted: result2 };
    } catch (error) {
      console.error('🔴 Error logging call initiation:', error);
    }
  }

  // لاگ کردن پایان تماس
  async logCallEnded(callData: any) {
    try {
      const logData = {
        call_id: callData.callId,
        caller_id: callData.caller_id,
        caller_username: callData.caller_username,
        callee_id: callData.callee_id,
        callee_username: callData.callee_username,
        action: 'CALL_ENDED',
        timestamp: new Date().toISOString(),
        duration: callData.duration || '0',
        reason: callData.reason || 'Call ended normally',
      };

      if (callData.wasAccepted) {
        await this.acceptedCall.LogCall(logData).toPromise();
        console.log('🚪 Call ended logged to acceptedCall');
      }
      await this.rejectedCall.LogCall(logData).toPromise();
      console.log('🚪 Call ended logged to rejectedCall');
    } catch (error) {
      console.error('🔴 Error logging call end:', error);
    }
  }
}
