import { existsSync, rmSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const targets = [
  'client/dist',
  'server-nest/dist',
  'client/node_modules/.vite',
  'server-nest/node_modules/.vite',
  'coverage',
  'client/coverage',
  'server-nest/coverage',
];

function assertInsideRoot(path) {
  const rel = relative(root, path);
  if (rel.startsWith('..') || rel === '') {
    throw new Error(`Refusing to remove outside project root: ${path}`);
  }
}

let removed = 0;
for (const target of targets) {
  const path = resolve(root, target);
  assertInsideRoot(path);
  if (!existsSync(path)) continue;
  rmSync(path, { recursive: true, force: true });
  removed += 1;
  console.log(`removed ${target}`);
}

if (!removed) console.log('nothing to clean');
