#!/usr/bin/env node
/**
 * 文案 / 交互回归 lint（spec 02 §6）。
 *
 * 把已经清理干净的规则固化成一道门，配合 CI 防止倒退：
 *   1) client/src 下不得出现原生 `window.confirm(` / `window.prompt(`
 *      —— 应统一走品牌弹窗 confirmDialog / promptDialog / reportDialog；
 *      三个单例桥自身保留 window.* 作为「未挂载时的安全回退」，豁免。
 *   2) 不得出现「登 录」「注 册」式 CJK 按钮中间空格（该用 letter-spacing，不是字面空格）。
 *      Changelog.tsx 是历史条目数据、会引用旧文案，豁免该项。
 *
 * 用法：`npm run lint:copy`（CI 里也会跑）。
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const files = execSync('git ls-files client/src', { encoding: 'utf8' })
  .trim().split('\n').filter((f) => /\.(ts|tsx)$/.test(f));

const NATIVE_ALLOW = /components\/(confirm|report|prompt)\.tsx$/; // 单例桥的 fallback
const CJK_SKIP = /pages\/Changelog\.tsx$/;                        // 历史条目数据

const errs = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const ln = i + 1;
    if (!NATIVE_ALLOW.test(f) && /window\.(confirm|prompt)\s*\(/.test(line)) {
      errs.push(`${f}:${ln}  原生 window.confirm/prompt —— 请改用 confirmDialog / promptDialog / reportDialog`);
    }
    if (!CJK_SKIP.test(f) && /登 录|注 册/.test(line)) {
      errs.push(`${f}:${ln}  「登 录 / 注 册」式 CJK 按钮空格 —— 去掉字面空格`);
    }
  });
}

if (errs.length) {
  console.error('✗ 文案 / 交互 lint 失败：\n' + errs.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ 文案 / 交互 lint 通过（检查 ${files.length} 个文件）`);
