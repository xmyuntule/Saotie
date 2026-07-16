import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HelpersService } from '../src/common/helpers.service';

// publicUser 是 API 对外的「用户对象契约」（API.md 明确列出的字段），也是安全要点：
// 绝不能泄露 password_hash 等内部字段。用假 follows/posts 仓库实例化，回归契约与脱敏。
function svc(opts: { followers?: number; following?: number; posts?: number; isFollowing?: boolean } = {}) {
  const follows = {
    count: async ({ where }: any) =>
      where.following_id !== undefined ? (opts.followers ?? 0) : (opts.following ?? 0),
    findOne: async () => (opts.isFollowing ? { id: 1 } : null),
  };
  const posts = { count: async () => opts.posts ?? 0 };
  return new HelpersService(null as any, follows as any, posts as any, null as any, null as any, null as any);
}
const fullUser = () =>
  ({
    id: 7, username: 'demo', nickname: '示例', avatar: 'a.png', cover: '', bio: 'hi',
    gender: 'secret', location: '上海', verified: 1, verified_note: '官方',
    vip: 1, vip_level: 2, vip_expires: '2026-08-01', role: 'user', banned: 0, title: '', avatar_frame: '',
    points: 100, experience: 500, balance: '8.50', checkin_streak: 3, last_checkin: '2026-07-01',
    created_at: '2026-01-01 00:00:00', last_login_at: '2026-07-02 00:00:00',
    password_hash: 'SECRET_HASH_should_never_leak',
  }) as any;

const PUBLIC_KEYS = [
  'id', 'username', 'nickname', 'avatar', 'cover', 'bio', 'gender', 'location',
  'verified', 'verifiedNote', 'vip', 'vipLevel', 'vipExpires', 'role', 'banned', 'title', 'avatarFrame',
  'points', 'experience', 'balance', 'level', 'levelProgress', 'checkinStreak', 'lastCheckin',
  'createdAt', 'lastLoginAt', 'followers', 'following', 'postCount', 'isFollowing',
];

describe('HelpersService.publicUser', () => {
  test('null 用户 → null', async () => {
    expect(await svc().publicUser(null)).toBeNull();
  });

  test('绝不泄露 password_hash（安全要点）', async () => {
    const pu = await svc().publicUser(fullUser());
    expect('password_hash' in pu).toBe(false);
    expect(JSON.stringify(pu)).not.toContain('SECRET_HASH');
  });

  test('恰好返回 API.md 约定的公开字段集（无多余内部字段）', async () => {
    const pu = await svc({ followers: 12, following: 3, posts: 9 }).publicUser(fullUser());
    for (const k of PUBLIC_KEYS) expect(pu).toHaveProperty(k);
    for (const k of Object.keys(pu)) expect(PUBLIC_KEYS).toContain(k);
  });

  test('布尔字段归一化 + 计数来自仓库', async () => {
    const pu = await svc({ followers: 12, following: 3, posts: 9 }).publicUser(fullUser());
    expect(pu.verified).toBe(true);
    expect(pu.vip).toBe(true);
    expect(pu.banned).toBe(false);
    expect(pu.vipLevel).toBe(2);
    expect(pu.followers).toBe(12);
    expect(pu.following).toBe(3);
    expect(pu.postCount).toBe(9);
    expect(pu.level).toBe(pu.levelProgress.level);
  });

  test('vipLevel 回落：无 vip_level 时由 vip 布尔推导', async () => {
    expect((await svc().publicUser({ ...fullUser(), vip: 1, vip_level: 0 })).vipLevel).toBe(1);
    expect((await svc().publicUser({ ...fullUser(), vip: 0, vip_level: 0 })).vipLevel).toBe(0);
  });

  test('expired vip is hidden from the public effective user shape', async () => {
    const pu = await svc().publicUser({
      ...fullUser(),
      vip: 1,
      vip_level: 3,
      vip_expires: '2020-01-01',
    });
    expect(pu.vip).toBe(false);
    expect(pu.vipLevel).toBe(0);
    expect(pu.vipExpires).toBe('2020-01-01');
  });

  test('title / avatarFrame 缺省为空串', async () => {
    const pu = await svc().publicUser({ ...fullUser(), title: null, avatar_frame: null });
    expect(pu.title).toBe('');
    expect(pu.avatarFrame).toBe('');
  });

  test('isFollowing：无 viewer=false、viewer 关注=true、viewer 是自己=false', async () => {
    expect((await svc({ isFollowing: true }).publicUser(fullUser())).isFollowing).toBe(false);
    expect((await svc({ isFollowing: true }).publicUser(fullUser(), 99)).isFollowing).toBe(true);
    expect((await svc({ isFollowing: true }).publicUser(fullUser(), 7)).isFollowing).toBe(false);
  });
});
