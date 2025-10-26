// logger1-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'logs',
        protoPath: join(__dirname, '../logs.proto'),
        url: 'localhost:5001',
      },
    },
  );

  await app.listen();
  console.log('✅ rejected Service is listening on port 5001');
}
bootstrap();
