import { describe, expect, test } from 'vitest';
import { fmtNum, timeAgo, parseRich, parseBlocks } from '../../client/src/lib/format';
import { vipTier, VIP_TIERS } from '../../client/src/lib/vip';

// 前端纯展示逻辑覆盖率补齐——此前前端 0 测试。这些是全站可见的展示函数：
// 点赞/阅读数「1.2w」、「3 分钟前」、#话题#/@提及/加粗/链接 高亮、会员档位。
// 都是无依赖纯函数，从 server-nest 的 vitest 相对 import 直接回归（不给 client 加测试运行时）。

describe('fmtNum (紧凑数字)', () => {
  test('<1000 原样', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(42)).toBe('42');
    expect(fmtNum(999)).toBe('999');
  });
  test('千位 → x.xk（整千去 .0）', () => {
    expect(fmtNum(1000)).toBe('1k');
    expect(fmtNum(1200)).toBe('1.2k');
    expect(fmtNum(1500)).toBe('1.5k');
    expect(fmtNum(9999)).toBe('10k'); // 9.999 → toFixed(1)=10.0 → 10k
  });
  test('万位 → x.xw（整万去 .0）', () => {
    expect(fmtNum(10000)).toBe('1w');
    expect(fmtNum(23456)).toBe('2.3w');
    expect(fmtNum(120000)).toBe('12w');
  });
  test('无效输入按 0 处理，数字字符串可解析', () => {
    expect(fmtNum(null)).toBe('0');
    expect(fmtNum(undefined)).toBe('0');
    expect(fmtNum('abc' as any)).toBe('0');
    expect(fmtNum('1500' as any)).toBe('1.5k');
  });
});

describe('timeAgo (中文相对时间)', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  test('空输入 → 空串', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('')).toBe('');
  });
  test('分档：刚刚 / 分钟 / 小时 / 天', () => {
    expect(timeAgo(ago(30 * 1000))).toBe('刚刚');
    expect(timeAgo(ago(5 * 60 * 1000))).toBe('5分钟前');
    expect(timeAgo(ago(3 * 3600 * 1000))).toBe('3小时前');
    expect(timeAgo(ago(2 * 86400 * 1000))).toBe('2天前');
  });
});

describe('parseRich (行内富文本分段)', () => {
  test('纯文本 → 单个 text 段', () => {
    expect(parseRich('普通文本')).toEqual([{ t: 'text', v: '普通文本' }]);
  });
  test('识别 @提及 / #话题# / 加粗 / 链接', () => {
    const parts = parseRich('嗨 @alice 看 #前端# **重点** [官网](https://a.com)');
    const types = parts.map((p) => p.t);
    expect(types).toContain('mention');
    expect(types).toContain('topic');
    expect(types).toContain('bold');
    expect(types).toContain('link');
    expect(parts.find((p) => p.t === 'mention')!.v).toBe('alice');
    expect(parts.find((p) => p.t === 'topic')!.v).toBe('前端');
    expect(parts.find((p) => p.t === 'bold')!.v).toBe('重点');
    const link = parts.find((p) => p.t === 'link')!;
    expect(link.v).toBe('官网');
    expect(link.h).toBe('https://a.com');
  });
});

describe('parseBlocks (块级解析)', () => {
  test('标题 / 无序列表 / 引用 / 段落', () => {
    const blocks = parseBlocks('# 大标题\n- 项一\n- 项二\n> 引用\n正文段落');
    const types = blocks.map((b) => b.t);
    expect(types).toContain('h1');
    expect(types).toContain('ul');
    expect(types).toContain('quote');
    expect(types).toContain('p');
    expect(blocks.find((b) => b.t === 'ul')!.items).toEqual(['项一', '项二']);
  });
  test('独占一行的图片 → img 块', () => {
    const blocks = parseBlocks('![图](https://a.com/x.png)');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].t).toBe('img');
    expect(blocks[0].src).toBe('https://a.com/x.png');
  });
});

describe('vipTier (会员档位)', () => {
  test('0 / null / undefined → null（非会员）', () => {
    expect(vipTier(0)).toBeNull();
    expect(vipTier(null)).toBeNull();
    expect(vipTier(undefined)).toBeNull();
  });
  test('1 / 2 / 3 → 对应档位', () => {
    expect(vipTier(1)!.name).toBe('青铜会员');
    expect(vipTier(2)!.short).toBe('VIP2');
    expect(vipTier(3)!.price).toBe(9800);
  });
  test('越界档位 → null', () => {
    expect(vipTier(4)).toBeNull();
    expect(vipTier(99)).toBeNull();
  });
  test('VIP_TIERS 等级与价格均单调递增', () => {
    for (let i = 1; i < VIP_TIERS.length; i++) {
      expect(VIP_TIERS[i].level).toBeGreaterThan(VIP_TIERS[i - 1].level);
      expect(VIP_TIERS[i].price).toBeGreaterThan(VIP_TIERS[i - 1].price);
    }
  });
});
