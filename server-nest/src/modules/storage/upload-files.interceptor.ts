import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import multer from 'multer';
import { Transform } from 'node:stream';
import { finalize, Observable } from 'rxjs';
import {
  UPLOAD_MEDIA_KIND_LABELS,
  UploadMediaKind,
  StorageService,
  uploadMediaKindFromMime,
} from './storage.service';

const MB = 1024 * 1024;
const MAX_FILES = 9;
const HARD_FILE_LIMIT_MB = 200;
const HARD_REQUEST_LIMIT_MB = 220;
const MAX_CONCURRENT_UPLOADS = 1;

function limitedMemoryStorage(
  storage: StorageService,
  limits: Record<UploadMediaKind, number>,
  purpose?: string,
  streamedKeys: string[] = [],
): multer.StorageEngine {
  let requestSize = 0;
  return {
    _handleFile(_req, file, callback) {
      const kind = uploadMediaKindFromMime(file.mimetype);
      if (!kind) return callback(new BadRequestException('仅支持图片、视频、音频、PDF 文档'));

      const maxMb = limits[kind];
      const maxBytes = maxMb * MB;
      if (kind !== 'image') {
        let size = 0;
        const limiter = new Transform({
          transform(chunk, _encoding, callback) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            requestSize += buffer.length;
            if (requestSize > HARD_REQUEST_LIMIT_MB * MB) {
              callback(new BadRequestException(`单次上传文件总量最高 ${HARD_REQUEST_LIMIT_MB}MB`));
              return;
            }
            if (size > maxBytes) {
              callback(new BadRequestException(`当前账号单个${UPLOAD_MEDIA_KIND_LABELS[kind]}最大 ${maxMb}MB`));
              return;
            }
            callback(null, buffer);
          },
        });
        file.stream.pipe(limiter);
        storage.uploadStream({
          stream: limiter,
          originalname: file.originalname,
          mimetype: file.mimetype,
        }, purpose).then((uploaded) => {
          streamedKeys.push(uploaded.key);
          callback(null, { size, storageUpload: uploaded } as any);
        }).catch((error) => {
          file.stream.resume();
          callback(error instanceof BadRequestException
            ? error
            : new BadRequestException(error?.message || '文件上传失败'));
        });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;

      const fail = (message: string) => {
        if (done) return;
        done = true;
        chunks.length = 0;
        file.stream.resume();
        callback(new BadRequestException(message));
      };

      file.stream.on('data', (chunk) => {
        if (done) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        requestSize += buffer.length;
        if (requestSize > HARD_REQUEST_LIMIT_MB * MB)
          return fail(`单次上传文件总量最高 ${HARD_REQUEST_LIMIT_MB}MB`);
        if (size > maxBytes)
          return fail(`当前账号单个${UPLOAD_MEDIA_KIND_LABELS[kind]}最大 ${maxMb}MB`);
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
  private static activeUploads = 0;

  constructor(private readonly storage: StorageService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const limits = await this.storage.uploadSizeLimitsMbForUser(req.user);
    if (UploadFilesInterceptor.activeUploads >= MAX_CONCURRENT_UPLOADS)
      throw new HttpException('当前上传任务较多，请稍后重试', 429);
    UploadFilesInterceptor.activeUploads += 1;

    try {
      await new Promise<void>((resolve, reject) => {
        const streamedKeys: string[] = [];
        const handler = multer({
          storage: limitedMemoryStorage(this.storage, limits, req.body?.purpose, streamedKeys),
          limits: { fileSize: HARD_FILE_LIMIT_MB * MB, files: MAX_FILES },
          fileFilter: (_req, file, cb) => {
            const ok = !!uploadMediaKindFromMime(file.mimetype);
            if (!ok) return cb(new BadRequestException('仅支持图片、视频、音频、PDF 文档'));
            return cb(null, true);
          },
        }).array('files', MAX_FILES);

        handler(req, res, (err: any) => {
          if (!err) return resolve();
          const cleanup = Promise.allSettled(streamedKeys.map((key) => this.storage.delete(key)));
          const rejectWith = (error: Error) => cleanup.then(() => reject(error));
          if (err?.code === 'LIMIT_FILE_SIZE') {
            return rejectWith(new BadRequestException(`单个文件最高 ${HARD_FILE_LIMIT_MB}MB`));
          }
          if (err?.code === 'LIMIT_FILE_COUNT') {
            return rejectWith(new BadRequestException(`最多只能上传 ${MAX_FILES} 个文件`));
          }
          return rejectWith(
            err instanceof BadRequestException
              ? err
              : new BadRequestException(err?.message || '文件上传失败'),
          );
        });
      });
    } catch (error) {
      UploadFilesInterceptor.activeUploads -= 1;
      throw error;
    }

    return next.handle().pipe(
      finalize(() => {
        UploadFilesInterceptor.activeUploads -= 1;
      }),
    );
  }
}
