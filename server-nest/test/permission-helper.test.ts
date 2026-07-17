import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HelpersService } from '../src/common/helpers.service';

const svc = () =>
  new HelpersService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );

describe('HelpersService permission helpers', () => {
  test('isAdmin only trusts the admin role', () => {
    const h = svc();
    expect(h.isAdmin({ role: 'admin' } as any)).toBe(true);
    expect(h.isAdmin({ role: 'user' } as any)).toBe(false);
    expect(h.isAdmin(null)).toBe(false);
  });

  test('requireAdmin rejects non-admin users', () => {
    const h = svc();
    expect(() => h.requireAdmin({ role: 'admin' } as any)).not.toThrow();
    expect(() => h.requireAdmin({ role: 'user' } as any)).toThrow(/无权操作/);
  });

  test('owner or admin can manage owned resources', () => {
    const h = svc();
    expect(h.canManageOwner({ id: 7, role: 'user' } as any, 7)).toBe(true);
    expect(h.canManageOwner({ id: 8, role: 'admin' } as any, 7)).toBe(true);
    expect(h.canManageOwner({ id: 8, role: 'user' } as any, 7)).toBe(false);
  });

  test('requireOwnerOrAdmin keeps the caller-facing denial message', () => {
    const h = svc();
    expect(() =>
      h.requireOwnerOrAdmin({ id: 8, role: 'user' } as any, 7, '无权删除'),
    ).toThrow(/无权删除/);
  });
});
