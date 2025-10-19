// src/webrtc/webrtc.module.ts
import { Module } from '@nestjs/common';
import { WebRtcGateway } from './webrtc.gateway';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  providers: [WebRtcGateway],
  exports: [WebRtcGateway],
})
export class WebRtcModule {}
