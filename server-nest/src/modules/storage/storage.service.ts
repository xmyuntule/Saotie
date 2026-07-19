import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import * as fs from 'node:fs';
import sharp from 'sharp';
import { SiteService } from '../site/site.service';

export type UploadPurpose =
  | 'avatar'
  | 'cover'
  | 'post'
  | 'thread'
  | 'message'
  | 'video-poster'
  | 'logo'
  | 'auth-background'
  | 'certification'
  | 'generic';

type ImagePolicy = {
  width: number;
  height: number;
  quality: number;
};

type StorageDriver = 'local' | 's3';

type StorageSettings = {
  driver: StorageDriver;
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  forcePathStyle: boolean;
  publicUrl: string;
  prefix: string;
};

const IMAGE_POLICIES: Record<UploadPurpose, ImagePolicy> = {
  avatar: { width: 320, height: 320, quality: 82 },
  cover: { width: 1920, height: 1080, quality: 84 },
  post: { width: 2560, height: 2560, quality: 86 },
  thread: { width: 2560, height: 2560, quality: 86 },
  message: { width: 2048, height: 2048, quality: 84 },
  'video-poster': { width: 1280, height: 720, quality: 86 },
  logo: { width: 1024, height: 1024, quality: 88 },
  'auth-background': { width: 1920, height: 1080, quality: 84 },
  certification: { width: 2048, height: 2048, quality: 84 },
  generic: { width: 2560, height: 2560, quality: 86 },
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private uploadsDir: string;
  private privateUploadsDir: string;
  private client?: S3Client;
  private clientSignature = '';

  constructor(
    private readonly config: ConfigService,
    private readonly site: SiteService,
  ) {
    this.uploadsDir =
      process.env.UPLOADS_DIR || join(__dirname, '..', '..', '..', 'uploads');
    this.privateUploadsDir =
      process.env.CERT_UPLOADS_DIR ||
      join(__dirname, '..', '..', '..', 'cert-uploads');
  }

  async onModuleInit() {
    try {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      fs.mkdirSync(this.privateUploadsDir, { recursive: true });
    } catch {
      /* already exists */
    }
    const settings = await this.resolveSettings().catch(() => null);
    if (!settings || settings.driver === 'local') {
      this.logger.log(
        `Local storage ready (dir=${this.uploadsDir} -> /uploads/*, private=${this.privateUploadsDir})`,
      );
      return;
    }
    this.logger.log(
      `Object storage ready (provider=aws-s3 bucket=${settings.bucket} region=${settings.region} endpoint=${settings.endpoint || 'aws-default'} pathStyle=${settings.forcePathStyle})`,
    );
  }

  private async cfg(
    key: string,
    fallback: string,
    overrides?: Record<string, any>,
    blankMeansFallback = false,
  ) {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
      const v = String(overrides[key] ?? '').trim();
      if (!(blankMeansFallback && v === '')) return v;
    }
    const stored = await this.site.getConfig(key);
    if (stored !== null) return String(stored).trim();
    return fallback;
  }

  private cleanPrefix(raw: string) {
    return String(raw || '')
      .replace(/\\/g, '/')
      .split('/')
      .map((part) => part.trim().replace(/[^A-Za-z0-9._-]/g, '-'))
      .filter(Boolean)
      .join('/')
      .slice(0, 120);
  }

  private async resolveSettings(overrides?: Record<string, any>): Promise<StorageSettings> {
    const s3 = this.config.get('s3') || {};
    const envDriver = String(process.env.STORAGE_DRIVER || '').toLowerCase();
    const fallbackDriver: StorageDriver =
      envDriver === 's3' || envDriver === 'local'
        ? (envDriver as StorageDriver)
        : s3.accessKey
          ? 's3'
          : 'local';
    const rawDriver = (
      await this.cfg('storage_driver', fallbackDriver, overrides, true)
    ).toLowerCase();
    const driver: StorageDriver = rawDriver === 's3' ? 's3' : 'local';
    const rawForcePathStyle = await this.cfg(
      'storage_s3_force_path_style',
      s3.forcePathStyle ? '1' : '0',
      overrides,
      true,
    );
    return {
      driver,
      endpoint: await this.cfg('storage_s3_endpoint', s3.endpoint || '', overrides),
      bucket: await this.cfg('storage_s3_bucket', s3.bucket || '', overrides, true),
      accessKey: await this.cfg('storage_s3_access_key', s3.accessKey || '', overrides, true),
      secretKey: await this.cfg('storage_s3_secret_key', s3.secretKey || '', overrides, true),
      region: await this.cfg('storage_s3_region', s3.region || 'us-east-1', overrides, true),
      forcePathStyle: rawForcePathStyle === '1' || rawForcePathStyle === 'true',
      publicUrl: await this.cfg('storage_s3_public_url', s3.publicUrl || '', overrides),
      prefix: this.cleanPrefix(await this.cfg('storage_s3_prefix', '', overrides)),
    };
  }

  private validateS3(settings: StorageSettings) {
    if (settings.driver !== 's3') return;
    const missing: string[] = [];
    if (!settings.bucket) missing.push('Bucket');
    if (!settings.region) missing.push('Region');
    if (!settings.accessKey) missing.push('AccessKey');
    if (!settings.secretKey) missing.push('SecretKey');
    if (missing.length) {
      throw new BadRequestException(`AWS S3 配置不完整：${missing.join('、')}`);
    }
  }

  private s3Client(settings: StorageSettings) {
    this.validateS3(settings);
    const signature = JSON.stringify({
      endpoint: settings.endpoint,
      region: settings.region,
      accessKey: settings.accessKey,
      secretKey: settings.secretKey,
      forcePathStyle: settings.forcePathStyle,
    });
    if (!this.client || this.clientSignature !== signature) {
      this.client = new S3Client({
        endpoint: settings.endpoint || undefined,
        region: settings.region,
        forcePathStyle: settings.forcePathStyle,
        credentials: {
          accessKeyId: settings.accessKey,
          secretAccessKey: settings.secretKey,
        },
      });
      this.clientSignature = signature;
    }
    return this.client;
  }

  /** Generate a collision-resistant object key preserving the file extension. */
  private buildKey(originalName: string): string {
    const ext = extname(originalName || '') || '';
    const stamp = Date.now();
    const rand = randomBytes(6).toString('hex');
    return `${stamp}-${rand}${ext}`;
  }

  private objectKey(originalName: string, settings: StorageSettings): string {
    const key = this.buildKey(originalName);
    return settings.prefix ? `${settings.prefix}/${key}` : key;
  }

  private normalizeObjectKey(key: string): string {
    const normalized = String(key || '').replace(/\\/g, '/');
    if (!normalized || normalized.includes('..') || normalized.startsWith('/')) {
      throw new BadRequestException('文件不存在');
    }
    return normalized;
  }

  private mediaType(mimetype: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'file';
  }

  private buildPrivateKey(originalName: string): string {
    return `certifications/${this.buildKey(originalName)}`;
  }

  private normalizePrivateKey(key: string): string {
    const normalized = String(key || '').replace(/\\/g, '/');
    if (
      !normalized ||
      normalized.includes('..') ||
      normalized.startsWith('/') ||
      !normalized.startsWith('certifications/')
    ) {
      throw new BadRequestException('文件不存在');
    }
    return normalized;
  }

  private async streamToBuffer(body: any): Promise<Buffer> {
    if (!body) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private imagePolicy(purpose?: string): ImagePolicy {
    return IMAGE_POLICIES[(purpose as UploadPurpose) || 'generic'] || IMAGE_POLICIES.generic;
  }

  /**
   * Normalize newly uploaded raster/vector images.
   * GIF is kept untouched so animated uploads do not silently become a still image.
   */
  private async optimizeImage(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    purpose?: string,
  ) {
    if (!file.mimetype.startsWith('image/') || file.mimetype === 'image/gif') {
      return file;
    }

    const policy = this.imagePolicy(purpose);
    try {
      const buffer = await sharp(file.buffer, {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: policy.width,
          height: policy.height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: policy.quality, effort: 4 })
        .toBuffer();

      // Do not replace a small source image with a larger derivative.
      if (buffer.length >= file.buffer.length) return file;

      const stem = file.originalname.replace(/\.[^/.]+$/, '') || 'image';
      return {
        buffer,
        originalname: `${stem}.webp`,
        mimetype: 'image/webp',
      };
    } catch (error: any) {
      this.logger.warn(`Image optimization failed: ${error?.message || error}`);
      throw new BadRequestException('图片无法处理，请更换图片格式或尺寸后重试');
    }
  }

  private encodedKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
  }

  /** Build the publicly reachable URL for an object key. */
  publicUrlFor(key: string, settings?: StorageSettings): string {
    const active = settings || {
      endpoint: this.config.get('s3.endpoint') || '',
      bucket: this.config.get('s3.bucket') || '',
      region: this.config.get('s3.region') || 'us-east-1',
      forcePathStyle: this.config.get('s3.forcePathStyle') === true,
      publicUrl: this.config.get('s3.publicUrl') || '',
    } as StorageSettings;
    const encoded = this.encodedKey(key);
    if (active.publicUrl) {
      return `${active.publicUrl.replace(/\/$/, '')}/${encoded}`;
    }
    if (!active.endpoint) {
      const regionHost = active.region === 'us-east-1'
        ? 's3.amazonaws.com'
        : `s3.${active.region}.amazonaws.com`;
      return `https://${active.bucket}.${regionHost}/${encoded}`;
    }
    const base = active.endpoint.replace(/\/$/, '');
    return active.forcePathStyle
      ? `${base}/${active.bucket}/${encoded}`
      : `${base.replace('://', `://${active.bucket}.`)}/${encoded}`;
  }

  /** Upload one buffer, returning the client-facing media descriptor. */
  async upload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }, purpose?: string): Promise<{ url: string; type: string; name: string; key: string }> {
    const settings = await this.resolveSettings();
    const prepared = await this.optimizeImage(file, purpose);
    const key = this.objectKey(prepared.originalname, settings);
    if (settings.driver === 'local') {
      const full = join(this.uploadsDir, key);
      await fs.promises.mkdir(dirname(full), { recursive: true });
      await fs.promises.writeFile(full, prepared.buffer);
      return {
        url: `/uploads/${key}`,
        type: this.mediaType(prepared.mimetype),
        name: file.originalname,
        key,
      };
    }
    await this.s3Client(settings).send(
      new PutObjectCommand({
        Bucket: settings.bucket,
        Key: key,
        Body: prepared.buffer,
        ContentType: prepared.mimetype,
        CacheControl: 'public, max-age=2592000, immutable',
      }),
    );
    return {
      url: this.publicUrlFor(key, settings),
      type: this.mediaType(prepared.mimetype),
      name: file.originalname,
      key,
    };
  }

  async uploadMany(
    files: { buffer: Buffer; originalname: string; mimetype: string }[],
    purpose?: string,
  ) {
    const uploaded: { url: string; type: string; name: string; key: string }[] = [];
    for (const file of files) {
      uploaded.push(await this.upload(file, purpose));
    }
    return uploaded;
  }

  async uploadPrivate(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }, purpose = 'certification'): Promise<{ key: string; type: string; name: string; mimetype: string; size: number }> {
    const settings = await this.resolveSettings();
    const prepared = await this.optimizeImage(file, purpose);
    const key = this.buildPrivateKey(prepared.originalname);
    if (settings.driver === 'local') {
      const full = join(this.privateUploadsDir, key);
      await fs.promises.mkdir(dirname(full), { recursive: true });
      await fs.promises.writeFile(full, prepared.buffer);
      return {
        key,
        type: this.mediaType(prepared.mimetype),
        name: file.originalname,
        mimetype: prepared.mimetype,
        size: prepared.buffer.length,
      };
    }
    await this.s3Client(settings).send(
      new PutObjectCommand({
        Bucket: settings.bucket,
        Key: key,
        Body: prepared.buffer,
        ContentType: prepared.mimetype,
        CacheControl: 'private, max-age=0, no-store',
      }),
    );
    return {
      key,
      type: this.mediaType(prepared.mimetype),
      name: file.originalname,
      mimetype: prepared.mimetype,
      size: prepared.buffer.length,
    };
  }

  async readPrivate(key: string): Promise<Buffer> {
    const settings = await this.resolveSettings();
    const safeKey = this.normalizePrivateKey(key);
    if (settings.driver === 'local') {
      return fs.promises.readFile(join(this.privateUploadsDir, safeKey));
    }
    const res = await this.s3Client(settings).send(
      new GetObjectCommand({ Bucket: settings.bucket, Key: safeKey }),
    );
    return this.streamToBuffer(res.Body);
  }

  async delete(key: string): Promise<void> {
    const settings = await this.resolveSettings();
    const safeKey = this.normalizeObjectKey(key);
    if (settings.driver === 'local') {
      await fs.promises.unlink(join(this.uploadsDir, safeKey)).catch(() => undefined);
      return;
    }
    await this.s3Client(settings).send(
      new DeleteObjectCommand({ Bucket: settings.bucket, Key: safeKey }),
    );
  }

  /** Presigned GET URL for private objects (default 1h). */
  async signedGetUrl(key: string, expiresIn = 3600): Promise<string> {
    const settings = await this.resolveSettings();
    const safeKey = this.normalizePrivateKey(key);
    if (settings.driver === 'local') {
      throw new BadRequestException('本地存储不支持对象存储签名链接');
    }
    return getSignedUrl(
      this.s3Client(settings),
      new GetObjectCommand({ Bucket: settings.bucket, Key: safeKey }),
      { expiresIn },
    );
  }

  async testS3Connection(overrides?: Record<string, any>) {
    const settings = await this.resolveSettings({
      ...(overrides || {}),
      storage_driver: 's3',
    });
    this.validateS3(settings);
    const key = this.objectKey(`saotie-s3-test-${Date.now()}.txt`, {
      ...settings,
      prefix: settings.prefix ? `${settings.prefix}/_health` : '_health',
    });
    const client = new S3Client({
      endpoint: settings.endpoint || undefined,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle,
      credentials: {
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.secretKey,
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: settings.bucket,
        Key: key,
        Body: Buffer.from('saotie-s3-test'),
        ContentType: 'text/plain; charset=utf-8',
      }),
    );
    await client.send(
      new DeleteObjectCommand({
        Bucket: settings.bucket,
        Key: key,
      }),
    );
    return {
      ok: true,
      bucket: settings.bucket,
      region: settings.region,
      endpoint: settings.endpoint || 'AWS 默认 Endpoint',
      publicUrl: this.publicUrlFor(key, settings),
    };
  }
}
