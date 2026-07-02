import { describe, test, expect } from 'vitest';
import { shouldBlockForUninitializedDb } from '../src/common/db-init.guard';

describe('shouldBlockForUninitializedDb (建表防呆 · spec 03 §3.2)', () => {
  test('核心表缺失 + 未开 synchronize → 拦（这正是要防的裸机漏配陷阱）', () => {
    expect(shouldBlockForUninitializedDb(false, false)).toBe(true);
  });

  test('核心表缺失 + synchronize=true → 放行（TypeORM 启动阶段会自动建表）', () => {
    expect(shouldBlockForUninitializedDb(false, true)).toBe(false);
  });

  test('核心表存在 + 未开 synchronize → 放行（生产稳定态的正常情形）', () => {
    expect(shouldBlockForUninitializedDb(true, false)).toBe(false);
  });

  test('核心表存在 + synchronize=true → 放行', () => {
    expect(shouldBlockForUninitializedDb(true, true)).toBe(false);
  });

  test('synchronize 为 undefined/null（未配）等同未开：缺表则拦、有表则放行', () => {
    expect(shouldBlockForUninitializedDb(false, undefined)).toBe(true);
    expect(shouldBlockForUninitializedDb(false, null)).toBe(true);
    expect(shouldBlockForUninitializedDb(true, undefined)).toBe(false);
  });
});
