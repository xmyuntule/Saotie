import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { extname, join } from 'node:path';
import * as fs from 'node:fs';

/**
 * 双模存储：
 *  - 'local'（默认，当未配置 S3 凭据时）：写本地 UPLOADS_DIR、返回 /uploads/<file>，
 *    与 Express(multer diskStorage) 完全一致；由 main.ts 的 useStaticAssets('/uploads') 伺服。
 *    线上 :5388 无 S3，必须走这条，否则新图上传 ECONNREFUSED。
 *  - 's3'：S3/MinIO/rustfs(配 S3_ACCESS_KEY 等 env 时启用)。
 * 两种模式返回的 { url, type, name } 形状一致，客户端无感。
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private driver: 's3' | 'local';
  private uploadsDir: string;
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;
  private endpoint: string;
  private forcePathStyle: boolean;

  constructor(private readonly config: ConfigService) {
    const s3 = this.config.get('s3');
    this.bucket = s3.bucket;
    this.endpoint = s3.endpoint;
    this.publicUrl = s3.publicUrl;
    this.forcePathStyle = s3.forcePathStyle;
    // 驱动选择：显式 STORAGE_DRIVER 优先；否则配了 S3 key 走 s3，没配走 local
    this.driver =
      (process.env.STORAGE_DRIVER as 's3' | 'local') ||
      (s3.accessKey ? 's3' : 'local');
    this.uploadsDir =
      process.env.UPLOADS_DIR || join(__dirname, '..', '..', '..', 'uploads');
    if (this.driver === 's3') {
      this.client = new S3Client({
        endpoint: s3.endpoint,
        region: s3.region,
        forcePathStyle: s3.forcePathStyle,
        credentials: {
          accessKeyId: s3.accessKey,
          secretAccessKey: s3.secretKey,
        },
      });
    }
  }

  onModuleInit() {
    if (this.driver === 'local') {
      try {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      } catch {
        /* 已存在 */
      }
      this.logger.log(`Local storage ready (dir=${this.uploadsDir} → /uploads/*)`);
    } else {
      this.logger.log(
        `Object storage ready (endpoint=${this.endpoint} bucket=${this.bucket} pathStyle=${this.forcePathStyle})`,
      );
    }
  }

  /** Generate a collision-resistant object key preserving the file extension. */
  private buildKey(originalName: string): string {
    const ext = extname(originalName || '') || '';
    const stamp = Date.now();
    const rand = randomBytes(6).toString('hex');
    return `${stamp}-${rand}${ext}`;
  }

  private mediaType(mimetype: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'file';
  }

  /** Build the publicly reachable URL for an object key. */
  publicUrlFor(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    const base = this.endpoint.replace(/\/$/, '');
    return this.forcePathStyle
      ? `${base}/${this.bucket}/${key}`
      : `${base.replace('://', `://${this.bucket}.`)}/${key}`;
  }

  /** Upload one buffer, returning the client-facing media descriptor. */
  async upload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<{ url: string; type: string; name: string; key: string }> {
    const key = this.buildKey(file.originalname);
    if (this.driver === 'local') {
      // 写本地磁盘，URL 与 Express 一致：/uploads/<file>
      await fs.promises.writeFile(join(this.uploadsDir, key), file.buffer);
      return {
        url: `/uploads/${key}`,
        type: this.mediaType(file.mimetype),
        name: file.originalname,
        key,
      };
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return {
      url: this.publicUrlFor(key),
      type: this.mediaType(file.mimetype),
      name: file.originalname,
      key,
    };
  }

  async uploadMany(
    files: { buffer: Buffer; originalname: string; mimetype: string }[],
  ) {
    return Promise.all(files.map((f) => this.upload(f)));
  }

  async delete(key: string): Promise<void> {
    if (this.driver === 'local') {
      await fs.promises.unlink(join(this.uploadsDir, key)).catch(() => undefined);
      return;
    }
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Presigned GET URL for private objects (default 1h). */
  async signedGetUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}
