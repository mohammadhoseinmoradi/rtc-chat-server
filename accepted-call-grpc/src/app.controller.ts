import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod('LogService', 'LogCall')
  LogCall(data: any) {
    console.log('📝 accepted-call log Received:', data);

    return {
      success: true,
      message: 'Logged by accepted-call successfully',
    };
  }
}
