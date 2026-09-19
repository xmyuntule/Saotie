import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { AdminService } from '../src/modules/admin/admin.service';

function setup(user: any) {
  const queries: string[] = [];
  const manager: any = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return sql.startsWith('SELECT COUNT') ? [{ count: 1 }] : { affectedRows: 1 };
    }),
    transaction: vi.fn(async (callback: any) => callback(manager)),
  };
  const service: any = Object.create(AdminService.prototype);
  service.users = { manager };
  service.helpers = {
    getUser: vi.fn(async () => user),
    logAdmin: vi.fn().mockResolvedValue(undefined),
  };
  return { service, manager, queries };
}

describe('AdminService.purgeUserContent', () => {
  test('requires the target to be banned', async () => {
    const { service } = setup({ id: 8, username: 'normal', nickname: '普通用户', role: 'user', banned: 0 });
    await expect(service.purgeUserContent(1, 8)).rejects.toThrow('请先封禁');
  });

  test('does not allow purging an administrator', async () => {
    const { service } = setup({ id: 8, username: 'staff', nickname: '管理员', role: 'admin', banned: 1 });
    await expect(service.purgeUserContent(1, 8)).rejects.toThrow('不能清理管理员');
  });

  test('cleans the banned user in one transaction and writes an audit log', async () => {
    const { service, manager, queries } = setup({ id: 8, username: 'bad-user', nickname: '恶意用户', role: 'user', banned: 1 });
    const result = await service.purgeUserContent(1, 8);

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(queries.some((sql) => sql.includes('DELETE FROM posts WHERE user_id = ?'))).toBe(true);
    expect(queries.some((sql) => sql.includes('DELETE FROM comments WHERE user_id = ?'))).toBe(true);
    expect(queries.some((sql) => sql.includes('DELETE FROM external_sync_sources WHERE user_id = ?'))).toBe(true);
    expect(queries.some((sql) => sql.includes('UPDATE rewards SET post_id = NULL'))).toBe(true);
    expect(result.deletedTotal).toBe(13);
    expect(service.helpers.logAdmin).toHaveBeenCalledWith(1, 'user.content.purge', expect.objectContaining({ targetId: 8 }));
  });
});
