import { describe, test, expect } from 'vitest';
import { defaultAvatar } from '../src/common/default-avatar';

describe('defaultAvatar (新用户默认头像 · spec 03 §3.5)', () => {
  test('默认（无 AVATAR_PROVIDER）→ 空串：前端渲染本地首字母头像，零外部依赖', () => {
    expect(defaultAvatar('bob', undefined)).toBe('');
  });

  test('即使传入外部 provider，也保持本地默认头像', () => {
    expect(defaultAvatar('bob', 'pravatar')).toBe('');
  });

  test('中文种子也不会生成外部头像 URL', () => {
    expect(defaultAvatar('张三', 'pravatar')).toBe('');
  });

  test('其它 provider 值一律回退空串', () => {
    expect(defaultAvatar('bob', 'gravatar')).toBe('');
    expect(defaultAvatar('bob', '')).toBe('');
  });
});
