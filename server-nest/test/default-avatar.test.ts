import { describe, test, expect } from 'vitest';
import { defaultAvatar } from '../src/common/default-avatar';

describe('defaultAvatar (新用户默认头像 · spec 03 §3.5)', () => {
  test('默认（无 AVATAR_PROVIDER）→ 空串：前端渲染本地首字母头像，零外部依赖', () => {
    expect(defaultAvatar('bob', undefined)).toBe('');
  });

  test('AVATAR_PROVIDER=pravatar → 沿用外部随机头像 URL（含 username 编码）', () => {
    expect(defaultAvatar('bob', 'pravatar')).toBe('https://i.pravatar.cc/240?u=bob');
  });

  test('中文用户名在 pravatar 模式下正确 encodeURIComponent', () => {
    expect(defaultAvatar('张三', 'pravatar')).toBe(
      'https://i.pravatar.cc/240?u=' + encodeURIComponent('张三'),
    );
  });

  test('其它 provider 值一律回退空串（只有 pravatar 显式开启外链）', () => {
    expect(defaultAvatar('bob', 'gravatar')).toBe('');
    expect(defaultAvatar('bob', '')).toBe('');
  });
});
