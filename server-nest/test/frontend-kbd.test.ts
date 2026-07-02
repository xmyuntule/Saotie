import { describe, test, expect, vi } from 'vitest';
import { onCtrlEnter } from '../../client/src/lib/kbd';

// 构造一个最小的 KeyboardEvent 替身（onCtrlEnter 只读 ctrlKey/metaKey/key/defaultPrevented + 调 preventDefault）
function ev(overrides: Partial<{ ctrlKey: boolean; metaKey: boolean; key: string; defaultPrevented: boolean }> = {}) {
  const e: any = { ctrlKey: false, metaKey: false, key: 'Enter', defaultPrevented: false, ...overrides };
  e.preventDefault = vi.fn(() => { e.defaultPrevented = true; });
  return e;
}

describe('onCtrlEnter (全发布器提交快捷键 · spec 01 §2.4)', () => {
  test('Ctrl+Enter → 触发 submit 并 preventDefault', () => {
    const submit = vi.fn();
    const e = ev({ ctrlKey: true });
    onCtrlEnter(submit)(e);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  test('⌘(meta)+Enter → 触发 submit（Mac）', () => {
    const submit = vi.fn();
    onCtrlEnter(submit)(ev({ metaKey: true }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test('单独 Enter（无 Ctrl/⌘）→ 不提交（保留换行）', () => {
    const submit = vi.fn();
    onCtrlEnter(submit)(ev({ ctrlKey: false, metaKey: false }));
    expect(submit).not.toHaveBeenCalled();
  });

  test('Ctrl + 其它键 → 不提交', () => {
    const submit = vi.fn();
    onCtrlEnter(submit)(ev({ ctrlKey: true, key: 'a' }));
    expect(submit).not.toHaveBeenCalled();
  });

  test('prev 处理器始终先执行（组合 @提及等已有 onKeyDown）', () => {
    const submit = vi.fn();
    const prev = vi.fn();
    onCtrlEnter(submit, prev)(ev({ ctrlKey: true }));
    expect(prev).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test('prev 若已 preventDefault（如 @提及选中）→ 不再触发 submit', () => {
    const submit = vi.fn();
    const prev = (e: any) => { e.defaultPrevented = true; }; // 模拟已消费该按键
    onCtrlEnter(submit, prev)(ev({ ctrlKey: true }));
    expect(submit).not.toHaveBeenCalled();
  });
});
