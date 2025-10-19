// src/common/filters/websocket-exception.filter.ts
import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    let errorMessage = 'An error occurred';

    if (exception instanceof WsException) {
      errorMessage = exception.message;
    } else if (exception instanceof HttpException) {
      errorMessage = exception.getResponse() as string;
    } else if (exception instanceof Error) {
      errorMessage = exception.message;
    }

    client.emit('error', {
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
