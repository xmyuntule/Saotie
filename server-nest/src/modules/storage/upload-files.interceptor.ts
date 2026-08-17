import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import multer, { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { StorageService } from './storage.service';

const MB = 1024 * 1024;
const MAX_FILES = 9;

@Injectable()
export class UploadFilesInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const limitMb = await this.storage.uploadSizeLimitMbForUser(req.user);

    await new Promise<void>((resolve, reject) => {
      const handler = multer({
        storage: memoryStorage(),
        limits: { fileSize: limitMb * MB, files: MAX_FILES },
        fileFilter: (_req, file, cb) => {
          const ok = /image\/|video\/|audio\//.test(file.mimetype);
          if (!ok) return cb(new BadRequestException('仅支持图片、视频、音频'));
          return cb(null, true);
        },
      }).array('files', MAX_FILES);

      handler(req, res, (err: any) => {
        if (!err) return resolve();
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return reject(new BadRequestException(`当前账号单个文件最大 ${limitMb}MB`));
        }
        if (err?.code === 'LIMIT_FILE_COUNT') {
          return reject(new BadRequestException(`最多只能上传 ${MAX_FILES} 个文件`));
        }
        return reject(
          err instanceof BadRequestException
            ? err
            : new BadRequestException(err?.message || '文件上传失败'),
        );
      });
    });

    return next.handle();
  }
}
