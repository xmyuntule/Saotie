import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 10mb JSON body to match the Express express.json({ limit: '10mb' })
    bodyParser: true,
  });

  const config = app.get(ConfigService);

  // 不暴露技术栈指纹（默认 Express 会带 X-Powered-By: Express）
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // CORS open like the Express server
  app.enableCors();

  // 安全响应头（零依赖手写；覆盖 API + 静态 SPA + /uploads，故置于静态中间件之前）。
  // 不设 CSP——本站大量内联样式 + SPA，贸然加 CSP 会破页面；CSP/HSTS 交给前置反代按部署环境配置。
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // 禁 MIME 嗅探
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // 防点击劫持(禁跨源 iframe 嵌入)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });

  // ── 单进程同时伺服 /uploads(历史本地图) + 内置 SPA，与 Express 一致 ──
  // 切换 systemd 到 server-nest 后整站靠这一个进程，故必须接管这两类静态资源。
  // 路径用 env 覆盖(切换时指向线上 ~/hahasns/server/uploads 与 ~/hahasns/client/dist)。
  const uploadsDir =
    process.env.UPLOADS_DIR || join(__dirname, '..', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    app.useStaticAssets(uploadsDir, {
      prefix: '/uploads',
      maxAge: '7d',
      setHeaders: (res) =>
        res.setHeader('Cache-Control', 'public, max-age=604800'),
    });
  }
  const clientDist =
    process.env.CLIENT_DIST || join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    // K 静态缓存：/assets/* 一年 immutable；字体 30 天；html 不缓存(每次拿新哈希)
    app.useStaticAssets(clientDist, {
      setHeaders: (res, p: string) => {
        if (p.includes('/assets/'))
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else if (p.includes('/fonts/'))
          res.setHeader('Cache-Control', 'public, max-age=2592000');
        else if (p.endsWith('.html'))
          res.setHeader('Cache-Control', 'no-cache');
      },
    });
  }

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
