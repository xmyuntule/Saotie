import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { CommentsService } from '../src/modules/comments/comments.service';

function makeService({ post = null as any, purchased = false, parent = null as any } = {}) {
  const state = { listed: 0, saved: 0 };
  const comments = {
    find: async () => { state.listed += 1; return []; },
    findOne: async ({ where }: any) => where.id === parent?.id ? parent : null,
    create: (value: any) => value,
    save: async (value: any) => { state.saved += 1; return { id: 1, ...value }; },
  };
  const posts = {
    findOne: async () => post,
    increment: async () => undefined,
  };
  const purchases = {
    findOne: async () => purchased ? { user_id: 2, post_id: post?.id } : null,
  };
  const service = new CommentsService(
    comments as any,
    null as any,
    posts as any,
    { findOne: async () => null } as any,
    null as any,
    { findOne: async () => null } as any,
    null as any,
    null as any,
    purchases as any,
  );
  return { service, state };
}

describe('CommentsService target access', () => {
  test('private post comments are hidden from anonymous and other users', async () => {
    const { service, state } = makeService({
      post: { id: 5, user_id: 1, visibility: 'private' },
    });
    await expect(service.list('5', undefined, undefined, undefined, null))
      .rejects.toThrow(/无权查看/);
    await expect(service.list('5', undefined, undefined, undefined, { id: 2, role: 'user' } as any))
      .rejects.toThrow(/无权查看/);
    expect(state.listed).toBe(0);
  });

  test('private post owner and administrators can read comments', async () => {
    const owner = makeService({ post: { id: 5, user_id: 1, visibility: 'private' } });
    await expect(owner.service.list('5', undefined, undefined, undefined, { id: 1, role: 'user' } as any))
      .resolves.toEqual({ comments: [] });
    const admin = makeService({ post: { id: 5, user_id: 1, visibility: 'private' } });
    await expect(admin.service.list('5', undefined, undefined, undefined, { id: 9, role: 'admin' } as any))
      .resolves.toEqual({ comments: [] });
  });

  test('paid post comments require a purchase for non-owners', async () => {
    const denied = makeService({ post: { id: 5, user_id: 1, visibility: 'paid' } });
    await expect(denied.service.list('5', undefined, undefined, undefined, { id: 2, role: 'user' } as any))
      .rejects.toThrow(/购买动态/);
    const allowed = makeService({
      post: { id: 5, user_id: 1, visibility: 'paid' },
      purchased: true,
    });
    await expect(allowed.service.list('5', undefined, undefined, undefined, { id: 2, role: 'user' } as any))
      .resolves.toEqual({ comments: [] });
  });

  test('rejects multiple targets and cross-target parent comments before saving', async () => {
    const multiple = makeService();
    await expect(multiple.service.list('5', '8', undefined, undefined, null))
      .rejects.toThrow(/只能指定一个/);

    const crossTarget = makeService({
      post: { id: 5, user_id: 1, visibility: 'public' },
      parent: { id: 20, post_id: 99, thread_id: null, article_id: null },
    });
    await expect(crossTarget.service.create(
      { id: 2, role: 'user' } as any,
      { postId: 5, parentId: 20, content: 'reply' },
    )).rejects.toThrow(/不属于当前内容/);
    expect(crossTarget.state.saved).toBe(0);
  });
});
