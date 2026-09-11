import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { SiteNotice } from '../src/database/entities';
import { NoticesService } from '../src/modules/notices/notices.service';

function setup(existing?: any) {
  const queryBuilder = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    create: vi.fn((_entity: any, value: any) => value),
    save: vi.fn(async (_entity: any, value: any) => ({ id: value.id || 9, ...value })),
    createQueryBuilder: vi.fn(() => queryBuilder),
  };
  const repo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(existing),
    manager: { transaction: vi.fn(async (callback: any) => callback(manager)) },
  };
  const helpers = {
    nowSql: vi.fn(() => '2026-09-11 12:00:00'),
    logAdmin: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new NoticesService(repo as any, helpers as any),
    repo,
    manager,
    queryBuilder,
  };
}

describe('NoticesService announcement ordering and pinning', () => {
  test('public notices are ordered by pin and publish time, newest first', async () => {
    const { service, repo } = setup();

    await service.listPublic();

    expect(repo.find).toHaveBeenCalledWith({
      where: { active: 1 },
      order: { pinned: 'DESC', created_at: 'DESC', id: 'DESC' },
      take: 5,
    });
  });

  test('creating a pinned notice clears the previous pinned notice first', async () => {
    const { service, manager } = setup();

    await service.create({ id: 7 } as any, { title: '新的置顶公告', pinned: true });

    expect(manager.update).toHaveBeenCalledWith(SiteNotice, { pinned: 1 }, { pinned: 0 });
    expect(manager.save).toHaveBeenCalledWith(
      SiteNotice,
      expect.objectContaining({ title: '新的置顶公告', pinned: 1, created_by: 7 }),
    );
  });

  test('pinning an existing notice clears every other pinned notice', async () => {
    const existing = {
      id: 12,
      title: '普通公告',
      body: '',
      level: 'info',
      link: '',
      link_label: '',
      active: 1,
      pinned: 0,
    };
    const { service, manager, queryBuilder } = setup(existing);

    await service.update(12, { pinned: true });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'pinned = :pinned AND id != :id',
      { pinned: 1, id: 12 },
    );
    expect(manager.save).toHaveBeenCalledWith(SiteNotice, expect.objectContaining({ id: 12, pinned: 1 }));
  });
});
