import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HelpersService } from '../src/common/helpers.service';

// 两个跨模块被依赖的不变量：
//  1) notify() 绝不给自己发通知（userId===actorId 或 userId 空则跳过）——否则点自己赞会收到通知。
//  2) nowSql()/today() 的字符串时间戳格式——全站入库时间与签到「今天」判断都依赖它可排序、空格分隔。
function svc() {
  const inserted: any[] = [];
  const notifications = { insert: async (row: any) => { inserted.push(row); } };
  const s = new HelpersService(
    null as any, null as any, null as any, notifications as any, null as any, null as any,
  );
  return { s, inserted };
}

describe('HelpersService.notify', () => {
  test('不给自己发通知（userId === actorId 跳过）', async () => {
    const { s, inserted } = svc();
    await s.notify({ userId: 5, actorId: 5, type: 'like' });
    expect(inserted).toHaveLength(0);
  });

  test('userId 为 0 / null → 跳过', async () => {
    const { s, inserted } = svc();
    await s.notify({ userId: 0 as any, type: 'like' });
    await s.notify({ userId: null as any, type: 'like' });
    expect(inserted).toHaveLength(0);
  });

  test('正常写入一条，字段映射正确', async () => {
    const { s, inserted } = svc();
    await s.notify({ userId: 5, actorId: 9, type: 'comment', targetType: 'post', targetId: 42, preview: '你好' });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      user_id: 5, actor_id: 9, type: 'comment', target_type: 'post', target_id: 42, preview: '你好',
    });
  });

  test('无 actorId → actor_id 记为 null', async () => {
    const { s, inserted } = svc();
    await s.notify({ userId: 5, type: 'system', preview: 'x' });
    expect(inserted[0].actor_id).toBeNull();
  });
});

describe('时间戳格式', () => {
  const s = () => new HelpersService(null as any, null as any, null as any, null as any, null as any, null as any);
  test('today() → YYYY-MM-DD', () => {
    expect(s().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  test('nowSql() → "YYYY-MM-DD HH:MM:SS"（空格分隔、无 T/Z、可排序）', () => {
    const v = s().nowSql();
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(v).not.toContain('T');
    expect(v).not.toContain('Z');
  });
});
