#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
function option(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

const version = option('--version');
const date = option('--date', new Date().toISOString().slice(0, 19).replace('T', ' '));
const itemsAt = args.indexOf('--items');
const rawItems = itemsAt >= 0 ? args.slice(itemsAt + 1) : [];
const items = rawItems.map((item) => {
  const split = item.indexOf('|');
  return { type: split > 0 ? item.slice(0, split) : 'improve', text: split > 0 ? item.slice(split + 1) : item };
});

if (!/^v\d+\.\d+$/.test(version) || !/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(date) || !items.length) {
  console.error('Usage: node scripts/changelog-add.mjs --version v4.94 --date "2026-09-15 15:00:00" --items "improve|描述"');
  process.exit(1);
}

const changelogPath = resolve('client/src/pages/Changelog.tsx');
const versionPath = resolve('client/src/version.ts');
let changelog = readFileSync(changelogPath, 'utf8');
const eol = changelog.includes('\r\n') ? '\r\n' : '\n';
if (new RegExp(`ver: ['"]${version.replace('.', '\\.')}`).test(changelog)) {
  throw new Error(`${version} already exists in ${changelogPath}`);
}
const entry = [
  '  {',
  `    ver: '${version}', date: '${date}', items: [`,
  ...items.map(({ type, text }) => `      [${JSON.stringify(type)}, ${JSON.stringify(text)}],`),
  '    ],',
  '  },',
].join(eol) + eol;
const marker = /const RELEASES = \[\r?\n/;
if (!marker.test(changelog)) throw new Error('RELEASES marker not found');
changelog = changelog.replace(marker, (match) => match + entry);
writeFileSync(changelogPath, changelog);

let versionSource = readFileSync(versionPath, 'utf8');
versionSource = versionSource.replace(/export const APP_VERSION = ['"]v\d+\.\d+['"];?/, `export const APP_VERSION = '${version}';`);
writeFileSync(versionPath, versionSource);
console.log(`Added ${version} to ${changelogPath} and updated ${versionPath}`);
