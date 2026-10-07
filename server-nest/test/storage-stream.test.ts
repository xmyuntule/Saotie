import 'reflect-metadata';
import { PassThrough } from 'node:stream';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { StorageService } from '../src/modules/storage/storage.service';

describe('StorageService.uploadStream', () => {
  test('writes a stream without requiring a complete input buffer', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saotie-upload-'));
    try {
      const service = new StorageService(
        { get: (key: string) => key === 's3' ? {} : undefined } as any,
        { getConfig: async () => null } as any,
        {} as any,
      );
      (service as any).uploadsDir = dir;
      const input = new PassThrough();
      const upload = service.uploadStream({
        stream: input,
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
      }, 'post');
      input.end(Buffer.from('streamed-video-content'));
      const result = await upload;
      const body = await readFile(join(dir, result.key));
      expect(result.type).toBe('video');
      expect(body.toString()).toBe('streamed-video-content');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('uploads S3 streams through retryable multipart parts', async () => {
    const commands: { name: string; input: any }[] = [];
    const client = {
      send: async (command: any) => {
        commands.push({ name: command.constructor.name, input: command.input });
        if (command.constructor.name === 'CreateMultipartUploadCommand') {
          return { UploadId: 'upload-1' };
        }
        if (command.constructor.name === 'UploadPartCommand') {
          return { ETag: `etag-${command.input.PartNumber}` };
        }
        return {};
      },
    };
    const service = new StorageService(
      { get: (key: string) => key === 's3' ? {} : undefined } as any,
      { getConfig: async () => null } as any,
      {} as any,
    );
    (service as any).resolveSettings = async () => ({
      driver: 's3',
      endpoint: '',
      bucket: 'saotie-media',
      accessKey: 'access',
      secretKey: 'secret',
      region: 'ap-east-1',
      forcePathStyle: false,
      publicUrl: '',
      prefix: '',
    });
    (service as any).s3Client = () => client;

    const input = new PassThrough();
    const upload = service.uploadStream({
      stream: input,
      originalname: 'clip.mp4',
      mimetype: 'video/mp4',
    }, 'post');
    input.end(Buffer.alloc(8 * 1024 * 1024 + 1, 7));
    const result = await upload;

    expect(result.type).toBe('video');
    expect(commands.map(({ name }) => name)).toEqual([
      'CreateMultipartUploadCommand',
      'UploadPartCommand',
      'UploadPartCommand',
      'CompleteMultipartUploadCommand',
    ]);
    expect(commands[1].input.ContentLength).toBe(8 * 1024 * 1024);
    expect(commands[2].input.ContentLength).toBe(1);
  });
});
