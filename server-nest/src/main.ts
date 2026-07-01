import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { isInsecureJwtSecret } from './common/jwt-secret.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 10mb JSON body to match the Express express.json({ limit: '10mb' })
    bodyParser: true,
  });

  const config = app.get(ConfigService);

  // 安全硬化：拒绝以「公开仓库可见的开发占位 JWT 密钥」启动。未设 JWT_SECRET 会静默回退到该占位串，
  // 任何人可据此伪造任意用户/管理员令牌（曾因线上漏配中招）。生产必须设强随机 JWT_SECRET（openssl rand -hex 32）；
  // 仅本地开发确需占位串时设 ALLOW_INSECURE_JWT_SECRET=true 放行。
  if (isInsecureJwtSecret(config.get<string>('jwt.secret'), process.env.ALLOW_INSECURE_JWT_SECRET)) {
    // eslint-disable-next-line no-console
    console.error(
      '[FATAL] 拒绝启动：JWT_SECRET 未设置，正在使用公开仓库可见的开发占位密钥，任何人可伪造登录令牌。\n' +
        '        生产环境请设置强随机 JWT_SECRET（如 openssl rand -hex 32）后重启。\n' +
        '        仅本地开发确需使用占位串时，可设 ALLOW_INSECURE_JWT_SECRET=true 放行。',
    );
    await app.close();
    process.exit(1);
  }

  // 不暴露技术栈指纹（默认 Express 会带 X-Powered-By: Express）
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // 反代信任：默认直连(req.ip=socket IP，适合 :5388 直连)。置于 nginx/面板反代后，
  // 设 TRUST_PROXY 让 req.ip 取 X-Forwarded-For（注册 IP 限流等需要真实客户端 IP）。
  // 取值：数字(信任前 N 跳，常用 1)、'loopback'、或 'true'(全信任，仅当反代已剥离伪造头时用)。
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const v =
      trustProxy === 'true'
        ? true
        : /^\d+$/.test(trustProxy)
          ? Number(trustProxy)
          : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', v);
  }

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
