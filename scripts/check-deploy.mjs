#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const strictEnv = process.env.REQUIRE_ENV === '1';
const strictDocker = process.env.REQUIRE_DOCKER === '1';
const minFreeMb = Number.parseInt(process.env.MIN_FREE_MB || '2048', 10);
const maxUsagePercent = Number.parseInt(process.env.MAX_ROOT_USAGE_PERCENT || '85', 10);

const failures = [];
const warnings = [];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    const commentIdx = value.search(/\s+#/);
    if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.silent ? 'ignore' : 'pipe',
    shell: false,
  });
}

function addProblem(target, message) {
  (target ? failures : warnings).push(message);
}

function checkEnv() {
  const env = { ...parseEnvFile('.env'), ...process.env };
  if (!existsSync('.env')) {
    addProblem(strictEnv, '.env is missing');
    return;
  }

  for (const key of ['JWT_SECRET', 'DB_PASSWORD']) {
    if (!env[key]) {
      failures.push(`${key} is required`);
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    failures.push('JWT_SECRET should be at least 32 characters');
  }
  if (env.DB_PASSWORD && env.DB_PASSWORD.length < 12) {
    failures.push('DB_PASSWORD should be at least 12 characters');
  }
  if (env.APP_PORT && !/^\d+$/.test(env.APP_PORT)) {
    failures.push('APP_PORT must be a number');
  }
  if (String(env.DB_SYNCHRONIZE || '').toLowerCase() === 'true' && env.ALLOW_DB_SYNCHRONIZE !== '1') {
    failures.push('DB_SYNCHRONIZE=true is blocked for production deploys');
  }
}

function checkDisk() {
  if (process.platform === 'win32') {
    warnings.push('disk check skipped on Windows');
    return;
  }

  const result = run('df', ['-Pk', '.']);
  if (result.status !== 0 || !result.stdout) {
    addProblem(strictEnv, 'unable to run df for disk check');
    return;
  }

  const lines = result.stdout.trim().split(/\r?\n/);
  const fields = lines[1]?.trim().split(/\s+/);
  if (!fields || fields.length < 5) {
    addProblem(strictEnv, 'unable to parse df output');
    return;
  }

  const freeMb = Math.floor(Number.parseInt(fields[3], 10) / 1024);
  const usagePercent = Number.parseInt(fields[4].replace('%', ''), 10);
  if (Number.isFinite(freeMb) && freeMb < minFreeMb) {
    failures.push(`free disk space is ${freeMb}MB, below ${minFreeMb}MB`);
  }
  if (Number.isFinite(usagePercent) && usagePercent > maxUsagePercent) {
    failures.push(`disk usage is ${usagePercent}%, above ${maxUsagePercent}%`);
  }
}

function checkDocker() {
  const docker = run('docker', ['--version'], { silent: true });
  if (docker.status !== 0) {
    addProblem(strictDocker, 'docker is unavailable');
    return;
  }

  const compose = run('docker', ['compose', 'version'], { silent: true });
  if (compose.status !== 0) {
    addProblem(strictDocker, 'docker compose is unavailable');
    return;
  }

  const config = run('docker', ['compose', 'config'], { silent: true });
  if (config.status !== 0) {
    failures.push('docker compose config failed');
  }
}

checkEnv();
checkDisk();
checkDocker();

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log('deploy check passed');
