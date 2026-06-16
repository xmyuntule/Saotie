import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

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

    res.status(status).json({ error: message });
  }
}
