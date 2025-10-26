import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @GrpcMethod('LogService', 'LogCall')
  LogCall(data: any) {
    console.log('📝 rejected-call Log Received:', data);

    return {
      success: true,
      message: 'Logged by rejected-call successfully',
    };
  }
}
