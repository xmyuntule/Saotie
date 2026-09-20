import 'reflect-metadata';
import { createHash } from 'crypto';
import { describe, expect, test, vi } from 'vitest';
import { PostUnlockToken } from '../src/database/entities';
import { PostsService } from '../src/modules/posts/posts.service';

function makeService(tokenRepo: any) {
  const helpers = {
    getUser: async (id: number) => ({ id, username: 'viewer', nickname: 'Viewer' }),
    publicUser: async (user: any) => user,
    nowSql: () => '2026-09-20 12:00:00',
  };
  const service = new PostsService(
    {} as any,
    {} as any,
    {} as any,
    { findOne: async () => null } as any,
    {} as any,
    { findOne: async () => null } as any,
    {} as any,
    { findOne: async () => null } as any,
    {} as any,
    { findOne: async () => null } as any,
    {} as any,
    {} as any,
    { findOne: async () => null } as any,
    {} as any,
    tokenRepo,
    helpers as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  (service as any).viewerLiked = vi.fn(async () => false);
  (service as any).viewerReactionFor = vi.fn(async () => null);
  (service as any).reactionCountsFor = vi.fn(async () => null);
  (service as any).buildPoll = vi.fn(async () => null);
  (service as any).buildRedPacket = vi.fn(async () => null);
  return service;
}

describe('password post unlock token', () => {
  test('valid token reveals the post while an expired token keeps it locked', async () => {
    const raw = 'short-lived-secret';
    const hash = createHash('sha256').update(raw).digest('hex');
    const tokenRepo = {
      findOne: vi.fn(async ({ where }: any) => where.token_hash === hash
        ? { user_id: 7, post_id: 42, token_hash: hash, expires_at: '2026-09-20 12:15:00' }
        : null),
    };
    const service = makeService(tokenRepo);
    const row: any = {
      id: 42,
      user_id: 99,
      content: 'secret content',
      media: '[]',
      media_type: 'text',
      visibility: 'password',
      password: 'unused-after-unlock',
      price: 0,
      location: '',
      device: '电脑端',
      topic_id: null,
      share_of: null,
      views: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      edited: 0,
      pinned: 0,
      global_pin_until: '',
      created_at: '2026-09-20 11:00:00',
    };

    const unlocked: any = await service.serializePost(row, 7, { unlockToken: raw });
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.locked).toBeNull();
    expect(unlocked.content).toBe('secret content');
    expect(tokenRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user_id: 7, post_id: 42, token_hash: hash }),
    }));

    const expiredRepo = { findOne: vi.fn(async () => null) };
    const locked: any = await makeService(expiredRepo).serializePost(row, 7, { unlockToken: raw });
    expect(locked.unlocked).toBe(false);
    expect(locked.locked).toEqual({ type: 'password' });
    expect(locked.content).toBe('secret content'.slice(0, 40));
  });

  test('stores only a hash and replaces the previous token for the same user/post', async () => {
    const tokenRepo = {
      delete: vi.fn(async () => undefined),
      save: vi.fn(async (value: any) => value),
    };
    const posts = {
      findOne: async () => ({
        id: 42,
        user_id: 99,
        visibility: 'password',
        password: 'open-sesame',
        content: 'secret',
        media: '[]',
      }),
    };
    const service = makeService(tokenRepo);
    (service as any).posts = posts;
    (service as any).serializePost = vi.fn(async () => ({ locked: { type: 'password' } }));
    const result: any = await service.unlock(42, { id: 7 } as any, 'open-sesame');

    expect(result.bypass).toBe(true);
    expect(result.unlockToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(tokenRepo.delete).toHaveBeenCalledWith({ user_id: 7, post_id: 42 });
    const saved = tokenRepo.save.mock.calls[0][0];
    expect(saved.token_hash).toHaveLength(64);
    expect(saved.token_hash).not.toBe(result.unlockToken);
    expect(saved.user_id).toBe(7);
    expect(saved.post_id).toBe(42);
  });
});
