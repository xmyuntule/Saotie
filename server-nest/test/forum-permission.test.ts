import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { ForumPermissionService } from '../src/modules/forum/forum-permission.service';

const svc = ({
  moderator = null,
  purchase = null,
  user = null,
}: {
  moderator?: any;
  purchase?: any;
  user?: any;
} = {}) =>
  new ForumPermissionService(
    { findOne: vi.fn(async () => moderator) } as any,
    { findOne: vi.fn(async () => purchase) } as any,
    {
      getUser: vi.fn(async () => user),
      isAdmin: vi.fn((u) => u?.role === 'admin'),
      canManageOwner: vi.fn((u, ownerId) => !!u && (u.id === ownerId || u.role === 'admin')),
    } as any,
  );

describe('ForumPermissionService', () => {
  test('isModerator treats admins as moderators', async () => {
    const permissions = svc({ user: { id: 1, role: 'admin' } });
    await expect(permissions.isModerator(3, 1)).resolves.toBe(true);
  });

  test('isModerator checks board moderator records for normal users', async () => {
    await expect(
      svc({ user: { id: 2, role: 'user' }, moderator: { board_id: 3, user_id: 2 } }).isModerator(3, 2),
    ).resolves.toBe(true);
    await expect(
      svc({ user: { id: 2, role: 'user' }, moderator: null }).isModerator(3, 2),
    ).resolves.toBe(false);
  });

  test('boardLockedFor only locks paid boards without moderator or purchase rights', async () => {
    const freeBoard = { id: 3, is_paid: 0, price: 0 } as any;
    const paidBoard = { id: 3, is_paid: 1, price: 20 } as any;

    await expect(svc().boardLockedFor(freeBoard, null)).resolves.toBe(false);
    await expect(svc().boardLockedFor(paidBoard, null)).resolves.toBe(true);
    await expect(
      svc({ user: { id: 2, role: 'user' }, purchase: { board_id: 3, user_id: 2 } }).boardLockedFor(paidBoard, 2),
    ).resolves.toBe(false);
    await expect(
      svc({ user: { id: 1, role: 'admin' } }).boardLockedFor(paidBoard, 1),
    ).resolves.toBe(false);
  });

  test('canDeleteThread allows moderators, owners and admins', () => {
    const permissions = svc();
    const thread = { user_id: 7 } as any;

    expect(permissions.canDeleteThread(thread, { id: 9, role: 'user' } as any, true)).toBe(true);
    expect(permissions.canDeleteThread(thread, { id: 7, role: 'user' } as any, false)).toBe(true);
    expect(permissions.canDeleteThread(thread, { id: 9, role: 'admin' } as any, false)).toBe(true);
    expect(permissions.canDeleteThread(thread, { id: 9, role: 'user' } as any, false)).toBe(false);
  });
});
