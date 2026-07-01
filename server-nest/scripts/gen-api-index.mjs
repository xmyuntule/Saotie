#!/usr/bin/env node
// 从各 NestJS controller 的路由装饰器自动生成「完整接口清单」Markdown，保证 docs/API.md
// 的接口总览与代码零漂移。新增/改动端点后跑一次，把输出粘回 docs/API.md 的「附录 · 完整接口清单」。
//
// 用法：
//   node scripts/gen-api-index.mjs            # 打印 Markdown 到 stdout
//   node scripts/gen-api-index.mjs --check    # 仅打印统计（控制器数/端点数），退出码 0
//
// 提取规则：@Controller('api/xxx') 作为基路径，@Get/@Post/@Put/@Patch/@Delete('sub') 为方法+子路径，
// 紧随其后的方法名作为 handler。纯静态扫描，不启动 Nest。
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const bt = String.fromCharCode(96);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const files = walk(SRC).sort();
const groups = {};
let total = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const ctrl = src.match(/@Controller\(\s*'([^']*)'\s*\)/);
  if (!ctrl) continue;
  const base = '/' + ctrl[1].replace(/^\/|\/$/g, '');
  const lines = src.split('\n');
  const routes = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`@(${METHODS.join('|')})\\(\\s*(?:'([^']*)')?\\s*\\)`));
    if (!m) continue;
    const verb = m[1].toUpperCase();
    const sub = (m[2] || '').replace(/^\//, '');
    const full = sub ? `${base}/${sub}` : base;
    let handler = '';
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const h = lines[j].match(/^\s*(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(/);
      if (h && !['if', 'for', 'while', 'switch', 'return'].includes(h[1])) { handler = h[1]; break; }
    }
    routes.push({ verb, full, handler });
    total++;
  }
  if (routes.length) groups[base] = routes;
}

const order = Object.keys(groups).sort((a, b) => a.localeCompare(b));

if (process.argv.includes('--check')) {
  console.log(`controllers=${files.length} modules=${order.length} handlers=${total}`);
  process.exit(0);
}

let md = `> 本清单由 ${bt}server-nest/scripts/gen-api-index.mjs${bt} 从各 controller 的路由装饰器自动提取，`;
md += `覆盖全部 **${total}** 个 HTTP handler（其中 **${total - 1}** 个业务接口 + 1 个 ${bt}GET /api/health${bt} 健康检查）。`;
md += `目的是让接口文档与代码零漂移；主要接口的请求/响应细节见上文各分节。\n\n`;
for (const base of order) {
  md += `**${bt}${base}${bt}**\n\n| 方法 | 路径 | Handler |\n|---|---|---|\n`;
  for (const r of groups[base]) md += `| ${r.verb} | ${bt}${r.full}${bt} | ${bt}${r.handler}${bt} |\n`;
  md += '\n';
}
process.stdout.write(md);
