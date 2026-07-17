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

  test('vipMultiplier maps active VIP levels to benefit rates', () => {
    const h = svc();
    expect(h.vipMultiplier({ vip: 0, vip_level: 0 } as any)).toBe(1);
    expect(h.vipMultiplier({ vip: 1, vip_level: 1 } as any)).toBe(1.2);
    expect(h.vipMultiplier({ vip: 1, vip_level: 2 } as any)).toBe(1.5);
    expect(h.vipMultiplier({ vip: 1, vip_level: 3 } as any)).toBe(2);
  });

  test('hasVipLevel allows admins and active VIP levels', () => {
    const h = svc();
    expect(h.hasVipLevel({ role: 'admin' } as any, 3)).toBe(true);
    expect(h.hasVipLevel({ role: 'user', vip: 1, vip_level: 3 } as any, 3)).toBe(
      true,
    );
    expect(h.hasVipLevel({ role: 'user', vip: 1, vip_level: 2 } as any, 3)).toBe(
      false,
    );
  });

  test('hasUserGroupAccess centralizes group and level checks', () => {
    const h = svc();
    const vip3 = {
      role: 'user',
      banned: 0,
      vip: 1,
      vip_level: 3,
      experience: h.expForLevel(5),
    } as any;
    expect(h.hasUserGroupAccess(vip3, 'vip3', { minLevel: 5 }).ok).toBe(true);
    expect(
      h.hasUserGroupAccess({ ...vip3, vip_level: 2 }, 'vip3').code,
    ).toBe('vip3');
    expect(
      h.hasUserGroupAccess({ ...vip3, banned: 1 }, 'vip3').code,
    ).toBe('banned');
    expect(
      h.hasUserGroupAccess({ ...vip3, experience: 0 }, 'vip', {
        minLevel: 5,
      }).code,
    ).toBe('level');
    expect(
      h.hasUserGroupAccess({ role: 'admin', banned: 0 } as any, 'vip3', {
        minLevel: 60,
      }).ok,
    ).toBe(true);
  });
});
