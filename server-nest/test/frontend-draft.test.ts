import { describe, expect, test, beforeEach } from 'vitest';
// 从 server-nest vitest 相对 import 前端草稿持久化纯逻辑（不给 client 加测试运行时）。
// draft.ts 让「未发送的动态」(正文/图片/投票…) 跨导航/刷新存活于 localStorage，并向后兼容旧的纯文本草稿。
import { loadDraft, saveDraft, clearDraft, hasDraft } from '../../client/src/lib/draft';

// 简易内存版 localStorage（node 环境无此全局）；每例重置，隔离。
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('composer draft persistence', () => {
  test('空态：loadDraft→null，hasDraft→false', () => {
    expect(loadDraft()).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  test('保存有正文的草稿 → true，可原样读回，hasDraft→true', () => {
    expect(saveDraft({ content: '写了一半的动态', vis: 'public' })).toBe(true);
    expect(loadDraft()).toEqual({ content: '写了一半的动态', vis: 'public' });
    expect(hasDraft()).toBe(true);
  });

  test('保存空草稿({}) → false 并清除；纯空白正文也视为空', () => {
    expect(saveDraft({})).toBe(false);
    expect(hasDraft()).toBe(false);
    expect(saveDraft({ content: '   \n  ' })).toBe(false);
    expect(hasDraft()).toBe(false);
  });

  test('仅图片 / 仅投票也算非空（内容判定 = 正文 || 图片 || 投票）', () => {
    expect(saveDraft({ media: [{ url: 'a.jpg' }] })).toBe(true);
    expect(saveDraft({ poll: { options: ['A', 'B'] } })).toBe(true);
    // 仅 vis/location 不含实质内容 → 空
    expect(saveDraft({ vis: 'public', location: '杭州' })).toBe(false);
  });

  test('从非空→空再次保存时会移除旧草稿（不残留）', () => {
    expect(saveDraft({ content: 'x' })).toBe(true);
    expect(hasDraft()).toBe(true);
    expect(saveDraft({ content: '' })).toBe(false);
    expect(loadDraft()).toBeNull();
  });

  test('clearDraft 清除草稿', () => {
    saveDraft({ content: 'x' });
    clearDraft();
    expect(loadDraft()).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  test('向后兼容：旧的纯文本草稿(非 { 开头)读作 { content }', () => {
    (globalThis as any).localStorage.setItem('haha_draft', '这是旧版纯文本草稿');
    expect(loadDraft()).toEqual({ content: '这是旧版纯文本草稿' });
    expect(hasDraft()).toBe(true);
  });

  test('损坏的 JSON(以 { 开头但非法) → loadDraft 容错返回 null', () => {
    (globalThis as any).localStorage.setItem('haha_draft', '{坏的:json,');
    expect(loadDraft()).toBeNull();
  });
});
