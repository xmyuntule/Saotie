import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { CommentsService } from '../src/modules/comments/comments.service';

// 删除评论的鉴权(access control)：只有作者本人或管理员可删，他人一律拒绝。
// mock comments 仓库测「真实」remove(不改源码)；用无 post/thread/article 关联的评论, 正例只走 delete、
// 不触发计数递减(其余仓库置 null 亦不被调用)。审计点名的「权限」测试覆盖。
function svc(comment: any) {
  const deleted: any[] = [];
  const helpers = {
    requireOwnerOrAdmin: (user: any, ownerId: number, message: string) => {
      if (user.id !== ownerId && user.role !== 'admin') throw new Error(message);
    },
  };
  const s = new CommentsService(
    { findOne: async () => comment, delete: async (x: any) => { deleted.push(x); } } as any, // comments
    null as any, null as any, null as any, null as any, null as any, null as any, helpers as any,
  );
  return { s, deleted };
}
const cmt = { id: 10, user_id: 5 }; // 作者是 user 5, 无 post/thread/article 关联

describe('CommentsService.remove — 删除鉴权', () => {
  test('评论不存在 → NotFound', async () => {
    const { s, deleted } = svc(null);
    await expect(s.remove(10, { id: 5, role: 'user' } as any)).rejects.toThrow(/不存在/);
    expect(deleted).toHaveLength(0);
  });

  test('非作者非管理员 → 拒绝(无权删除)，不删除', async () => {
    const { s, deleted } = svc(cmt);
    await expect(s.remove(10, { id: 2, role: 'user' } as any)).rejects.toThrow(/无权删除/);
    expect(deleted).toHaveLength(0);
  });

  test('作者本人 → 允许删除', async () => {
    const { s, deleted } = svc(cmt);
    await s.remove(10, { id: 5, role: 'user' } as any);
    expect(deleted).toEqual([{ id: 10 }]);
  });

  test('管理员(非作者) → 允许删除(admin 越权)', async () => {
    const { s, deleted } = svc(cmt);
    await s.remove(10, { id: 99, role: 'admin' } as any);
    expect(deleted).toEqual([{ id: 10 }]);
  });
});
