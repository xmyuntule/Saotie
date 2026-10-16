import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import express from 'express';
import type { Server } from 'http';
import { NotFoundException } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { AdminService } from '../src/modules/admin/admin.service';
import { SeoService } from '../src/modules/seo/seo.service';
import { SeoController } from '../src/modules/seo/seo.controller';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const verification = '<meta name="google-adsense-account" content="ca-pub-5449751815007696">';
const shell = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>';
const dist = mkdtempSync(join(tmpdir(), 'saotie-head-'));
const previousDist = process.env.CLIENT_DIST;
let code = verification;
let base: string;
let server: Server;
const site = { getConfig: vi.fn(async () => code), setConfig: vi.fn(async (_key: string, value: string) => { code = value; }) };
let seo: SeoService;

beforeAll(async () => {
  process.env.CLIENT_DIST = dist;
  writeFileSync(join(dist, 'index.html'), shell);
  seo = new SeoService(...[...Array(8).fill({}), site] as ConstructorParameters<typeof SeoService>);
  const controller = new SeoController(seo);
  const filter = new HttpExceptionFilter(seo);
  const app = express();
  app.get(['/', '/index.html'], (_req, res) => seo.sendSpa(res));
  app.get('/discover', (req, res) => controller.staticPage({}, req, res));
  app.get('/robots.txt', (_req, res) => controller.robots(res));
  app.use((req, res) => filter.catch(new NotFoundException(), {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any));
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});

beforeEach(() => {
  code = verification;
  vi.clearAllMocks();
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  if (previousDist === undefined) delete process.env.CLIENT_DIST;
  else process.env.CLIENT_DIST = previousDist;
  rmSync(dist, { recursive: true, force: true });
});

describe('website verification in original HTML responses', () => {
  test.each(['/', '/index.html', '/discover', '/settings', '/admin'])('%s exposes verification in head without running JavaScript', async (path) => {
    const response = await fetch(base + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    const doc = new JSDOM(html).window.document;
    expect(doc.head.querySelectorAll('meta[name="google-adsense-account"]')).toHaveLength(1);
    expect(doc.head.querySelector('meta[name="google-adsense-account"]')?.getAttribute('content')).toBe('ca-pub-5449751815007696');
    expect(doc.body.querySelector('#root')).not.toBeNull();
  });

  test('crawler pages and SEO 404 pages include the same verification', async () => {
    const response = await fetch(base + '/discover', { headers: { 'user-agent': 'Googlebot', accept: 'text/html' } });
    const doc = new JSDOM(await response.text()).window.document;
    expect(doc.head.querySelector('meta[name="google-adsense-account"]')).not.toBeNull();
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/discover');
    const html = await seo.renderPage({ title: 'Missing', description: 'Missing', path: '/post/404' }, { noindex: true });
    const missing = new JSDOM(html).window.document;
    expect(missing.head.querySelector('meta[name="google-adsense-account"]')).not.toBeNull();
    expect(missing.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
  });

  test('admin configuration saves, reads back, updates and clears the tags without a rebuild', async () => {
    const admin: AdminService = Object.create(AdminService.prototype);
    Object.assign(admin, { site, helpers: { logAdmin: vi.fn() } });
    const tags = `${verification}\n<meta name="google-site-verification" content="test-token">`;
    expect(await admin.updateConfig(1, { site_head_html: tags })).toEqual({ ok: true, changed: ['site_head_html'] });
    expect(site.setConfig).toHaveBeenCalledWith('site_head_html', tags);
    expect((await admin.getConfig()).config.site_head_html).toBe(tags);
    expect(await (await fetch(base + '/')).text()).toContain(tags);
    await admin.updateConfig(1, { site_head_html: '' });
    expect(await (await fetch(base + '/')).text()).toBe(shell);
  });

  test('script contents and multiple tags are preserved literally', async () => {
    code = `${verification}\n<script async src="https://example.com/sdk.js"></script>\n<script>window.test = "$& $\u0060 $' $$";</script>`;
    const html = await (await fetch(base + '/')).text();
    expect(html).toContain(code + '\n</head>');
    const doc = new JSDOM(html).window.document;
    expect(doc.head.querySelectorAll('script')).toHaveLength(2);
  });

  test.each(['/api/does-not-exist', '/uploads/missing', '/assets/missing.js'])('keeps %s as an actual 404', async (path) => {
    const response = await fetch(base + path);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not Found' });
    expect(site.getConfig).not.toHaveBeenCalled();
  });

  test('robots stays plain text and does not include HTML', async () => {
    const response = await fetch(base + '/robots.txt');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).not.toContain('<meta');
    expect(site.getConfig).not.toHaveBeenCalled();
  });

  test('an unavailable configuration does not prevent the SPA from loading', async () => {
    site.getConfig.mockRejectedValueOnce(new Error('database temporarily unavailable'));
    expect(await (await fetch(base + '/')).text()).toBe(shell);
  });
});
