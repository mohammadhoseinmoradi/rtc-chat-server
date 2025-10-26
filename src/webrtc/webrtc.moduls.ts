// src/webrtc/webrtc.module.ts
import { Module } from '@nestjs/common';
import { WebRtcGateway } from './webrtc.gateway';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { CallLoggerService } from './webrtc.callLogger.service';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  providers: [WebRtcGateway, CallLoggerService],
  exports: [WebRtcGateway],
})
export class WebRtcModule {}
