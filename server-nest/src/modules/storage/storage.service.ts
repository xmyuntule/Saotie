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
import { extname } from 'node:path';

/**
 * S3-compatible object storage. Targets rustfs by default but works against
 * any MinIO/AWS-S3 endpoint via env (S3_ENDPOINT/S3_BUCKET/keys/region/path-style).
 *
 * Returned `url` mirrors the Express upload contract — { url, type, name } —
 * so the client treats S3 objects the same as the old /uploads/ files.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
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

  onModuleInit() {
    this.logger.log(
      `Object storage ready (endpoint=${this.endpoint} bucket=${this.bucket} pathStyle=${this.forcePathStyle})`,
    );
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
