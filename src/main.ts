import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '15mb' })); // รองรับรูปใบเสร็จ base64 ขนาดใหญ่
  app.use(express.urlencoded({ extended: true }));
  app.enableCors();
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server is running on port ${port} (0.0.0.0)`);
}
bootstrap();
