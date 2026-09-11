// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { activateDialog } from '../../client/src/lib/dialog';
import { isSearchShortcut } from '../../client/src/lib/search-shortcut';

const cleanups: Array<() => void> = [];
beforeEach(() => {
  // jsdom has no layout engine; model visibility while testing focus behavior.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList;
  });
  if (!('inert' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'inert', {
      configurable: true,
      get() { return this.hasAttribute('inert'); },
      set(value: boolean) { this.toggleAttribute('inert', value); },
    });
  }
  document.body.innerHTML = '<main id="app"><button id="trigger">打开</button></main><aside id="already-inert" inert></aside>';
  document.getElementById('trigger')!.focus();
});
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});
function open(close = vi.fn()) {
  const layer = document.createElement('div');
  layer.innerHTML = '<section tabindex="-1" role="dialog"><button>取消</button><button disabled>禁用</button><div hidden><button>隐藏</button></div><button>确认</button></section>';
  document.body.append(layer);
  const panel = layer.firstElementChild as HTMLElement;
  const cleanup = activateDialog(layer, panel, close);
  const stop = () => { cleanup(); layer.remove(); };
  cleanups.push(stop);
  return { layer, panel, close, buttons: panel.querySelectorAll('button') };
}
function key(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  document.activeElement!.dispatchEvent(event);
  return event;
}

describe('shared dialog behavior', () => {
  test('locks the background and restores the original focus, overflow and inert state', () => {
    document.body.style.overflow = 'scroll';
    const { panel } = open();
    expect(document.activeElement).toBe(panel);
    expect(document.getElementById('app')!.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    cleanups.pop()!();
    expect(document.activeElement?.id).toBe('trigger');
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.getElementById('app')!.inert).toBe(false);
    expect(document.getElementById('already-inert')!.inert).toBe(true);
  });
  test('wraps Tab in both directions and skips disabled or hidden controls', () => {
    const { buttons } = open();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    key('Tab', true);
    expect(document.activeElement).toBe(buttons[3]);
    key('Tab');
    expect(document.activeElement).toBe(buttons[0]);
  });
  test('Escape dismisses only the top dialog; cancelling restores focus inside the composer', () => {
    const outer = open();
    outer.buttons[0].focus();
    const inner = open();
    key('Escape');
    expect(inner.close).toHaveBeenCalledOnce();
    expect(outer.close).not.toHaveBeenCalled();
    expect(outer.layer.inert).toBe(true);
    cleanups.pop()!();
    expect(document.activeElement).toBe(outer.buttons[0]);
    expect(outer.layer.inert).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    key('Escape');
    expect(outer.close).toHaveBeenCalledOnce();
  });
  test('closing an underlying dialog does not steal focus or unlock an open confirmation', () => {
    open();
    const inner = open();
    cleanups.shift()!();
    expect(document.activeElement).toBe(inner.panel);
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('search keyboard shortcuts', () => {
  function shortcut(key: string, target: HTMLElement, extras: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, ...extras });
    target.dispatchEvent(event);
    return isSearchShortcut(event);
  }
  test('supports slash and Ctrl/Cmd K from content', () => {
    expect(shortcut('/', document.body)).toBe(true);
    expect(shortcut('k', document.body, { ctrlKey: true })).toBe(true);
    expect(shortcut('k', document.body, { metaKey: true })).toBe(true);
  });
  test('does not steal typing, IME input or modal keystrokes', () => {
    const input = document.createElement('input');
    document.body.append(input);
    expect(shortcut('/', input)).toBe(false);
    expect(shortcut('k', input, { ctrlKey: true })).toBe(false);
    expect(shortcut('/', document.body, { isComposing: true })).toBe(false);
    const { buttons } = open();
    expect(shortcut('/', buttons[0])).toBe(false);
  });
});
