// @vitest-environment jsdom
/** @jsxImportSource ../../client/node_modules/react */
import React, { act } from '../../client/node_modules/react';
import { createRoot, type Root } from '../../client/node_modules/react-dom/client';
import { MemoryRouter } from '../../client/node_modules/react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Home from '../../client/src/pages/Home';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../client/src/api/client', () => ({ default: { get } }));
vi.mock('../../client/src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 }, setAuthOpen: vi.fn() }) }));
vi.mock('../../client/src/components/Shell', () => ({ default: ({ children }: any) => <main>{children}</main> }));
vi.mock('../../client/src/components/Composer', () => ({ default: () => <div>发布</div> }));
vi.mock('../../client/src/components/SiteNotice', () => ({ default: () => null }));
vi.mock('../../client/src/components/PostCard', () => ({ default: ({ post }: any) => <article>{post.content}</article> }));
vi.mock('../../client/src/components/Widgets', () => ({ WhoToFollow: () => null }));

let root: Root;
let container: HTMLDivElement;
const observers = new Set<() => void>();
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  get.mockReset();
  vi.stubGlobal('IntersectionObserver', class {
    callback: () => void;
    constructor(callback: (entries: any[]) => void) { this.callback = () => callback([{ isIntersecting: true }]); }
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  observers.clear();
  vi.unstubAllGlobals();
});
const feed = (content: string, hasMore = false) => ({ data: { posts: [{ id: content, content }], hasMore } });
const click = async (label: string) => {
  const button = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
};
const intersect = async () => { await act(async () => { [...observers].forEach((callback) => callback()); }); };

test('failed initial requests show a recoverable error instead of an empty feed', async () => {
  get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(feed('重试后的动态'));
  await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('动态加载失败');
  expect(container.textContent).not.toContain('还没有动态');
  await click('重新加载');
  expect(container.querySelector('article')?.textContent).toBe('重试后的动态');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('a stale pagination response cannot append posts from the previous filter', async () => {
  let resolveOld!: (value: any) => void;
  get.mockResolvedValueOnce(feed('推荐动态', true))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(feed('最新动态'));
  await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>));
  await intersect();
  await click('最新');
  await act(async () => resolveOld(feed('旧推荐的第二页')));
  expect(container.textContent).toContain('最新动态');
  expect(container.textContent).not.toContain('旧推荐的第二页');
});

test('pagination errors keep visible posts and wait for an explicit retry', async () => {
  get.mockResolvedValueOnce(feed('第一页', true))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(feed('第二页'));
  await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>));
  await intersect();
  expect(container.textContent).toContain('第一页');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('后续动态加载失败');
  await intersect();
  expect(get).toHaveBeenCalledTimes(2);
  await click('重新加载');
  expect(container.querySelectorAll('article')).toHaveLength(2);
  expect(get.mock.calls[2][1].params.offset).toBe(1);
});
