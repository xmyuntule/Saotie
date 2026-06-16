import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 10mb JSON body to match the Express express.json({ limit: '10mb' })
    bodyParser: true,
  });

  const config = app.get(ConfigService);

  // CORS open like the Express server
  app.enableCors();

  // larger JSON bodies (base64 media in posts, etc.)
  const express = require('express');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // class-validator DTOs; whitelist strips unknown props, transform coerces types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // normalize all errors to { error: "..." } (Express-compatible)
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = config.get<number>('port') || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`HahaSNS (NestJS) API running on http://localhost:${port}`);
}

bootstrap();
