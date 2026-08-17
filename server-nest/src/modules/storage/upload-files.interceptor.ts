import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import multer from 'multer';
import { Observable } from 'rxjs';
import {
  UPLOAD_MEDIA_KIND_LABELS,
  UploadMediaKind,
  StorageService,
  uploadMediaKindFromMime,
} from './storage.service';

const MB = 1024 * 1024;
const MAX_FILES = 9;
const HARD_FILE_LIMIT_MB = 200;

function limitedMemoryStorage(limits: Record<UploadMediaKind, number>): multer.StorageEngine {
  return {
    _handleFile(_req, file, callback) {
      const kind = uploadMediaKindFromMime(file.mimetype);
      if (!kind) return callback(new BadRequestException('仅支持图片、视频、音频、PDF 文档'));

      const maxMb = limits[kind];
      const maxBytes = maxMb * MB;
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;

      const fail = () => {
        if (done) return;
        done = true;
        chunks.length = 0;
        file.stream.resume();
        callback(new BadRequestException(`当前账号单个${UPLOAD_MEDIA_KIND_LABELS[kind]}最大 ${maxMb}MB`));
      };

      file.stream.on('data', (chunk) => {
        if (done) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > maxBytes) return fail();
        chunks.push(buffer);
      });
      file.stream.on('error', (err) => {
        if (done) return;
        done = true;
        callback(err);
      });
      file.stream.on('end', () => {
        if (done) return;
        done = true;
        callback(null, {
          buffer: Buffer.concat(chunks),
          size,
        });
      });
    },
    _removeFile(_req, file, callback) {
      delete (file as Partial<Express.Multer.File>).buffer;
      callback(null);
    },
  };
}

@Injectable()
export class UploadFilesInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const limits = await this.storage.uploadSizeLimitsMbForUser(req.user);

    await new Promise<void>((resolve, reject) => {
      const handler = multer({
        storage: limitedMemoryStorage(limits),
        limits: { fileSize: HARD_FILE_LIMIT_MB * MB, files: MAX_FILES },
        fileFilter: (_req, file, cb) => {
          const ok = !!uploadMediaKindFromMime(file.mimetype);
          if (!ok) return cb(new BadRequestException('仅支持图片、视频、音频、PDF 文档'));
          return cb(null, true);
        },
      }).array('files', MAX_FILES);

      handler(req, res, (err: any) => {
        if (!err) return resolve();
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return reject(new BadRequestException(`单个文件最高 ${HARD_FILE_LIMIT_MB}MB`));
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
