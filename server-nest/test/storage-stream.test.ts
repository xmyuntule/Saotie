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
});
