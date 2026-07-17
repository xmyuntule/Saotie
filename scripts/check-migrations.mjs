#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const migrationDir = 'server-nest/src/database/migrations';
const dataSourcePath = 'server-nest/src/database/data-source.ts';
let migrationCount = 0;

function fail(message) {
  failures.push(message);
}

if (!existsSync(dataSourcePath)) {
  fail(`${dataSourcePath} is missing`);
} else {
  const dataSource = readFileSync(dataSourcePath, 'utf8');
  if (!/synchronize:\s*false/.test(dataSource)) {
    fail('database data source must keep synchronize: false');
  }
  if (!/migrations:\s*\[/.test(dataSource)) {
    fail('database data source does not declare migrations');
  }
}

if (!existsSync(migrationDir) || !statSync(migrationDir).isDirectory()) {
  fail(`${migrationDir} is missing`);
} else {
  const migrations = readdirSync(migrationDir)
    .filter((name) => name.endsWith('.ts'))
    .filter((name) => !name.endsWith('.d.ts'))
    .sort();

  if (migrations.length === 0) {
    migrationCount = 0;
  } else {
    migrationCount = migrations.length;
  }

  const seen = new Set();
  for (const name of migrations) {
    const fullPath = join(migrationDir, name);
    const source = readFileSync(fullPath, 'utf8');
    if (!/^\d{13,}-.+\.ts$/.test(name)) {
      fail(`${fullPath} should use a timestamp prefix, e.g. 1720000000000-AddTable.ts`);
    }
    if (!/implements\s+MigrationInterface/.test(source)) {
      fail(`${fullPath} should implement MigrationInterface`);
    }
    if (!/async\s+up\s*\(/.test(source)) {
      fail(`${fullPath} is missing async up()`);
    }
    if (!/async\s+down\s*\(/.test(source)) {
      fail(`${fullPath} is missing async down()`);
    }

    const timestamp = name.split('-', 1)[0];
    if (seen.has(timestamp)) {
      fail(`${fullPath} has a duplicate migration timestamp`);
    }
    seen.add(timestamp);
  }

  if (process.env.REQUIRE_MIGRATIONS === '1' && migrations.length === 0) {
    fail('REQUIRE_MIGRATIONS=1 but no migration files were found');
  }
}

if (failures.length > 0) {
  for (const message of failures) {
    console.error(`FAIL: ${message}`);
  }
  process.exit(1);
}

console.log(`migration check passed (${migrationCount} file${migrationCount === 1 ? '' : 's'})`);
