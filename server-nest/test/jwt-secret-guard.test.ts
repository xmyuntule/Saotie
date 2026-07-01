import { describe, expect, test } from 'vitest';
import { DEV_JWT_PLACEHOLDER, isInsecureJwtSecret } from '../src/common/jwt-secret.guard';

// 启动守卫纯逻辑：解析出的 JWT 密钥「不安全」(空/公开占位串) 且未显式放行 → true(拒绝启动)。
// 防「线上漏配 JWT_SECRET 静默用公开占位密钥」这类认证绕过再次发生。
describe('isInsecureJwtSecret', () => {
  test('占位串 + 未放行 → true（拒绝启动）', () => {
    expect(isInsecureJwtSecret(DEV_JWT_PLACEHOLDER, undefined)).toBe(true);
    expect(isInsecureJwtSecret(DEV_JWT_PLACEHOLDER, '')).toBe(true);
    expect(isInsecureJwtSecret(DEV_JWT_PLACEHOLDER, 'false')).toBe(true);
  });

  test('空/undefined 密钥 + 未放行 → true（防御性：视作不安全）', () => {
    expect(isInsecureJwtSecret(undefined, undefined)).toBe(true);
    expect(isInsecureJwtSecret('', undefined)).toBe(true);
    expect(isInsecureJwtSecret(null, undefined)).toBe(true);
  });

  test('占位串 + 显式放行(ALLOW_INSECURE_JWT_SECRET=true) → false（本地开发逃生阀）', () => {
    expect(isInsecureJwtSecret(DEV_JWT_PLACEHOLDER, 'true')).toBe(false);
  });

  test('真实强随机密钥 → false（放行，与是否放行标记无关）', () => {
    const real = 'a3f1c9e7b25d8406f1a2c3d4e5f60718293a4b5c6d7e8f90112233445566778899';
    expect(isInsecureJwtSecret(real, undefined)).toBe(false);
    expect(isInsecureJwtSecret(real, 'true')).toBe(false);
    expect(isInsecureJwtSecret(real, 'false')).toBe(false);
  });

  test('放行标记只认精确的字符串 "true"（"TRUE"/"1"/"yes" 不算放行）', () => {
    for (const v of ['TRUE', 'True', '1', 'yes', 'y']) {
      expect(isInsecureJwtSecret(DEV_JWT_PLACEHOLDER, v)).toBe(true);
    }
  });
});
