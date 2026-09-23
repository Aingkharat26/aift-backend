import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '15mb' })); // รองรับรูปใบเสร็จ base64 ขนาดใหญ่
  app.use(express.urlencoded({ extended: true }));
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  console.log(`[Bootstrap] Starting server on port ${port} (0.0.0.0)...`);
  await app.listen(port, '0.0.0.0');
  console.log(`[Bootstrap] Server successfully running on port ${port} (0.0.0.0)`);
}
bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal error starting server:', err);
  process.exit(1);
});
