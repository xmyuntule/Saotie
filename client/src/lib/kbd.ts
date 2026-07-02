import type { KeyboardEvent } from 'react';

/**
 * Ctrl / ⌘ + Enter 提交——全站发布器统一快捷键（spec 01 §2.4）。
 * 返回一个 onKeyDown 处理器；可选 `prev` 让已有的 onKeyDown（如 @提及）继续生效。
 *   onKeyDown={onCtrlEnter(submit)}
 *   onKeyDown={onCtrlEnter(submit, mention.onKeyDown)}   // 组合已有处理器
 */
export function onCtrlEnter<E extends KeyboardEvent = KeyboardEvent>(
  submit: () => void,
  prev?: (e: E) => void,
) {
  return (e: E) => {
    prev?.(e);
    if (!e.defaultPrevented && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };
}
