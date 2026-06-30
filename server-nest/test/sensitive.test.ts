import { beforeEach, describe, expect, test } from 'vitest';
import { checkSensitive, setSensitiveConfig } from '../src/common/sensitive';

// 敏感词过滤是内容审核的安全要点：既要拦住违禁词，也要扛住「加空格/标点/大小写」的绕过，
// 还要能被后台总开关与自定义词表控制。这些都是纯逻辑，最适合做第一批自动化回归。
describe('checkSensitive (moderation filter)', () => {
  beforeEach(() => setSensitiveConfig('1', '')); // 每例前：开启、清空自定义词

  test('clean / empty / null 文本放行', () => {
    expect(checkSensitive('你好，今天天气不错～')).toBeNull();
    expect(checkSensitive('')).toBeNull();
    expect(checkSensitive(null)).toBeNull();
    expect(checkSensitive(undefined)).toBeNull();
  });

  test('命中内置违禁词，返回原词', () => {
    expect(checkSensitive('你这个傻逼')).toBe('傻逼');
  });

  test('归一化能扛住 空格/标点/大小写 绕过', () => {
    expect(checkSensitive('傻 逼')).toBe('傻逼'); // 中间空格
    expect(checkSensitive('傻-逼')).toBe('傻逼'); // 连字符
    expect(checkSensitive('s.m.d.b')).toBe('smdb'); // 点分隔
    expect(checkSensitive('NMSL')).toBe('nmsl'); // 大小写不敏感
  });

  test('后台自定义词表生效（中文逗号/换行/分号分隔）', () => {
    setSensitiveConfig('1', '禁词甲，禁词乙\n禁词丙;禁词丁');
    expect(checkSensitive('文本里有禁词甲哦')).toBe('禁词甲');
    expect(checkSensitive('还有禁词丁')).toBe('禁词丁');
    expect(checkSensitive('正常内容')).toBeNull();
  });

  test('总开关关闭后，全部放行', () => {
    setSensitiveConfig('0', '');
    expect(checkSensitive('你这个傻逼')).toBeNull();
  });

  test('开关默认开（传 null 视为开启）', () => {
    setSensitiveConfig(null, null);
    expect(checkSensitive('傻逼')).toBe('傻逼');
  });
});
