import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../src/common/guards/optional-auth.guard';

const context = (authorization = 'Bearer valid') => {
  const req: any = { headers: { authorization } };
  return {
    req,
    ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any,
  };
};

const deps = (user: any) => ({
  jwt: { verify: () => ({ id: 7 }) } as any,
  config: { get: () => 'secret' } as any,
  users: { findOne: async () => user } as any,
});

describe('authentication guards — banned sessions', () => {
  test('required auth rejects an existing JWT immediately after the user is banned', async () => {
    const d = deps({ id: 7, banned: 1 });
    const guard = new JwtAuthGuard(d.jwt, d.config, d.users);
    const { ctx, req } = context();
    await expect(guard.canActivate(ctx)).rejects.toThrow(/账号已被封禁/);
    expect(req.user).toBeUndefined();
  });

  test('optional auth treats a banned JWT as anonymous', async () => {
    const d = deps({ id: 7, banned: 1 });
    const guard = new OptionalAuthGuard(d.jwt, d.config, d.users);
    const { ctx, req } = context();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toBeNull();
  });

  test('active users remain authenticated', async () => {
    const user = { id: 7, banned: 0 };
    const d = deps(user);
    const guard = new JwtAuthGuard(d.jwt, d.config, d.users);
    const { ctx, req } = context();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toBe(user);
  });
});
