import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HelpersService } from '../src/common/helpers.service';

// @提及 / #话题# 解析器是「通知」与「话题聚合」的入口：发帖 / 评论后据此发提及通知、建话题索引。
// 纯字符串逻辑、不碰任何 repository，用 null 依赖实例化即可回归（不连库、test/ 不进 nest build）。
// 本文件锁定「当前真实行为」，含若干已知边界（如邮箱 alice@blog.com 会被当成 @blog、
// `# #` 去空格后留空串）——记为未来加固线索；此轮仅补测试、不改线上解析逻辑。
const h = new HelpersService(
  null as any,
  null as any,
  null as any,
  null as any,
  null as any,
  null as any,
);

describe('parseMentions (@提及)', () => {
  test('空 / null / 无提及 → []', () => {
    expect(h.parseMentions('')).toEqual([]);
    expect(h.parseMentions(null as any)).toEqual([]);
    expect(h.parseMentions('一段没有提及的普通文本')).toEqual([]);
  });

  test('提取并去重，保留首次出现顺序', () => {
    expect(h.parseMentions('@alice 你好 @bob，再 @alice 一次')).toEqual(['alice', 'bob']);
  });

  test('支持中文用户名 + 下划线 + 数字', () => {
    expect(h.parseMentions('@张三 @user_01 @李四2024')).toEqual(['张三', 'user_01', '李四2024']);
  });

  test('遇到名字字符集外的符号即停止', () => {
    expect(h.parseMentions('@bob! @amy。')).toEqual(['bob', 'amy']);
    expect(h.parseMentions('@bob-smith')).toEqual(['bob']); // 连字符不在 [一-龥A-Za-z0-9_] 集合
  });

  test('名字最长 20 字符（超出截断）', () => {
    const long = 'a'.repeat(25);
    expect(h.parseMentions('@' + long)).toEqual([long.slice(0, 20)]);
  });

  test('【已知边界·锁定】邮箱式 alice@blog.com 会被解析为 @blog', () => {
    expect(h.parseMentions('reach me at alice@blog.com')).toEqual(['blog']);
  });
});

describe('parseTopics (#话题#)', () => {
  test('空 / null / 无话题 → []', () => {
    expect(h.parseTopics('')).toEqual([]);
    expect(h.parseTopics(null as any)).toEqual([]);
    expect(h.parseTopics('没有话题标记的文本')).toEqual([]);
  });

  test('成对 # 之间提取、trim、去重', () => {
    expect(h.parseTopics('聊聊 #前端# 和 # 设计 #，再来 #前端#')).toEqual(['前端', '设计']);
  });

  test('多个相邻话题', () => {
    expect(h.parseTopics('#a##b#')).toEqual(['a', 'b']);
  });

  test('内容最长 30 字符：30 命中、31 不命中', () => {
    expect(h.parseTopics('#' + 'x'.repeat(30) + '#')).toEqual(['x'.repeat(30)]);
    expect(h.parseTopics('#' + 'x'.repeat(31) + '#')).toEqual([]);
  });

  test('换行不计入话题内容（含换行的 #…# 不匹配）', () => {
    expect(h.parseTopics('#第一行\n第二行#')).toEqual([]);
  });
});
