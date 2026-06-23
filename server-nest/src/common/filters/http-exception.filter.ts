import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';

const CLIENT_DIST =
  process.env.CLIENT_DIST || join(__dirname, '..', '..', '..', 'client', 'dist');
const INDEX_HTML = join(CLIENT_DIST, 'index.html');

/**
 * Normalizes every error to the Express server's shape: { error: "<message>" }.
 * The client reads `err.response.data.error`, so we must NOT emit Nest's default
 * { statusCode, message, error } body. Validation errors (arrays) collapse to
 * their first message. Status codes are preserved (400/401/402/403/404/409...).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const m = (body as any).message;
        if (Array.isArray(m)) message = m[0];
        else if (typeof m === 'string') message = m;
        else message = (body as any).error || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(exception.stack);
    }

    // SPA 兜底：未匹配任何路由的 GET（非 /api、非 /uploads）回前端 index.html，
    // 让 React Router 深链刷新不 404。只有真正没命中路由/静态文件时才会走到这里，
    // 因此不会遮蔽任何 API 路由（区别于 @Get('*') 通配控制器会抢在 API 之前）。
    if (
      status === HttpStatus.NOT_FOUND &&
      req?.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/uploads') &&
      !req.path.includes('.') && // 静态资源(.js/.css/.png…)缺失就保持 404
      fs.existsSync(INDEX_HTML)
    ) {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(INDEX_HTML);
      return;
    }

    res.status(status).json({ error: message });
  }
}
