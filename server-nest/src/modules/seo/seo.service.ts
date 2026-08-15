import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { Article, Board, Circle, Post, Question, Thread, Topic, User } from '../../database/entities';

export type SeoPage = {
  title: string;
  description: string;
  path: string;
  image?: string;
  author?: string;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  schemaType?: 'WebPage' | 'Article' | 'SocialMediaPosting' | 'ProfilePage' | 'CollectionPage' | 'Question';
  section?: string;
  stats?: string;
};

type SitemapUrl = { loc: string; lastmod?: string | null; priority?: string; changefreq?: string };

const SITE_NAME = 'Saotie';
const DEFAULT_DESCRIPTION = 'Saotie 是一个围绕动态、帖子、问答、圈子和专栏展开的兴趣社区。';
const BOT_RE = /(baiduspider|googlebot|bingbot|sogou|360spider|bytespider|yisouspider|duckduckbot|slurp|yandex|petalbot|applebot|facebookexternalhit|twitterbot|linkedinbot|telegrambot|whatsapp|discordbot|crawler|spider|bot|preview)/i;

@Injectable()
export class SeoService {
  private readonly clientDist = process.env.CLIENT_DIST || join(process.cwd(), '..', 'client', 'dist');

  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Board) private readonly boards: Repository<Board>,
    @InjectRepository(Circle) private readonly circles: Repository<Circle>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(Thread) private readonly threads: Repository<Thread>,
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  shouldServeSeo(req: Request) {
    if (String(req.query?.seo || '') === '1') return true;
    const accept = String(req.headers.accept || '');
    const ua = String(req.headers['user-agent'] || '');
    return BOT_RE.test(ua) && (!accept || accept.includes('text/html') || accept.includes('*/*'));
  }

  sendSpa(res: Response) {
    const indexPath = join(this.clientDist, 'index.html');
    if (existsSync(indexPath)) {
      res.type('text/html').setHeader('Cache-Control', 'no-cache');
      return res.send(readFileSync(indexPath, 'utf8'));
    }
    return res.status(404).type('text/plain').send('Saotie app shell is not available.');
  }

  sendNotFound(res: Response, path: string) {
    res.status(404).type('text/html').setHeader('Cache-Control', 'public, max-age=60');
    res.send(this.renderPage({
      title: '内容未找到',
      description: '这条内容可能已删除、设为私密，或暂时无法公开访问。',
      path,
      schemaType: 'WebPage',
    }, { noindex: true }));
  }

  robotsTxt() {
    const base = this.baseUrl();
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /member',
      'Disallow: /settings',
      'Disallow: /messages',
      'Disallow: /notifications',
      'Disallow: /api/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n');
  }

  async sitemapXml() {
    const base = this.baseUrl();
    const urls: SitemapUrl[] = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/discover', priority: '0.8', changefreq: 'hourly' },
      { loc: '/forum', priority: '0.8', changefreq: 'daily' },
      { loc: '/flash', priority: '0.8', changefreq: 'hourly' },
      { loc: '/circles', priority: '0.7', changefreq: 'daily' },
      { loc: '/qa', priority: '0.7', changefreq: 'daily' },
      { loc: '/articles', priority: '0.8', changefreq: 'daily' },
    ];

    const [posts, articles, threads, questions, circles, boards, topics, users] = await Promise.all([
      this.posts.find({ where: { visibility: 'public', price: 0 }, order: { created_at: 'DESC' }, take: 240 }),
      this.articles.find({ order: { created_at: 'DESC' }, take: 200 }),
      this.publicThreads(200),
      this.questions.find({ order: { created_at: 'DESC' }, take: 200 }),
      this.circles.find({ order: { created_at: 'DESC' }, take: 200 }),
      this.boards.find({ where: { is_paid: 0 }, order: { created_at: 'DESC' }, take: 120 }),
      this.topics.find({ order: { hot: 'DESC' }, take: 120 }),
      this.users.find({ where: { banned: 0 }, order: { created_at: 'DESC' }, take: 160 }),
    ]);

    for (const p of posts.filter((p) => this.isPublicPost(p)).slice(0, 200)) {
      urls.push({ loc: `/post/${p.id}`, lastmod: p.created_at, priority: '0.7', changefreq: 'weekly' });
    }
    for (const a of articles) urls.push({ loc: `/article/${a.id}`, lastmod: a.created_at, priority: '0.75', changefreq: 'weekly' });
    for (const t of threads) urls.push({ loc: `/thread/${t.id}`, lastmod: t.last_reply_at || t.created_at, priority: '0.72', changefreq: 'weekly' });
    for (const q of questions) urls.push({ loc: `/qa/${q.id}`, lastmod: q.created_at, priority: '0.7', changefreq: 'weekly' });
    for (const c of circles.filter((c) => c.slug)) urls.push({ loc: `/circle/${encodeURIComponent(c.slug || '')}`, lastmod: c.created_at, priority: '0.65', changefreq: 'weekly' });
    for (const b of boards.filter((b) => b.slug)) urls.push({ loc: `/forum/${encodeURIComponent(b.slug)}`, lastmod: b.created_at, priority: '0.65', changefreq: 'weekly' });
    for (const t of topics) urls.push({ loc: `/topic/${encodeURIComponent(t.name)}`, lastmod: t.created_at, priority: '0.65', changefreq: 'weekly' });
    for (const u of users) urls.push({ loc: `/u/${encodeURIComponent(u.username)}`, lastmod: u.updated_at || u.created_at, priority: '0.6', changefreq: 'weekly' });

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((u) => [
        '  <url>',
        `    <loc>${this.xml(base + u.loc)}</loc>`,
        u.lastmod ? `    <lastmod>${this.xml(this.dateOnly(u.lastmod))}</lastmod>` : '',
        u.changefreq ? `    <changefreq>${u.changefreq}</changefreq>` : '',
        u.priority ? `    <priority>${u.priority}</priority>` : '',
        '  </url>',
      ].filter(Boolean).join('\n')),
      '</urlset>',
      '',
    ].join('\n');
  }

  staticPage(path: string): SeoPage {
    const data: Record<string, Pick<SeoPage, 'title' | 'description' | 'section' | 'schemaType'>> = {
      '/discover': { title: '发现话题', description: '浏览 Saotie 社区里的热门动态、话题和最新观点。', section: '发现', schemaType: 'CollectionPage' },
      '/forum': { title: '论坛', description: '进入 Saotie 论坛，查看最新回复、热门帖子与精选讨论。', section: '论坛', schemaType: 'CollectionPage' },
      '/flash': { title: '资讯快报', description: '查看站内快报、实时热榜和热门讨论入口。', section: '快报', schemaType: 'CollectionPage' },
      '/circles': { title: '圈子', description: '寻找同好圈子，加入感兴趣的社区并参与讨论。', section: '圈子', schemaType: 'CollectionPage' },
      '/qa': { title: '问答', description: '发布问题、回答疑惑，查看社区里的问答内容。', section: '问答', schemaType: 'CollectionPage' },
      '/articles': { title: '专栏文章', description: '阅读 Saotie 用户发布的专栏文章、观点和经验内容。', section: '专栏', schemaType: 'CollectionPage' },
    };
    return { ...data[path], path };
  }

  async post(id: number): Promise<SeoPage | null> {
    if (!Number.isFinite(id)) return null;
    const p = await this.posts.findOne({ where: { id } });
    if (!p || !this.isPublicPost(p)) return null;
    const author = await this.users.findOne({ where: { id: p.user_id } });
    if (!author || author.banned) return null;
    const media = this.parseMedia(p.media);
    const summary = this.excerpt(p.content, 160) || `${author.nickname} 在 Saotie 发布了一条${this.mediaLabel(p.media_type)}动态。`;
    const title = this.excerpt(p.content, 46) || `${author.nickname} 的动态`;
    return {
      title,
      description: summary,
      path: `/post/${p.id}`,
      image: this.firstMediaImage(media) || this.publicUrl(author.avatar || author.cover || ''),
      author: author.nickname || author.username,
      publishedAt: p.created_at,
      schemaType: 'SocialMediaPosting',
      section: '动态',
      stats: `${p.views} 浏览 · ${p.like_count} 赞 · ${p.comment_count} 评论`,
    };
  }

  async article(id: number): Promise<SeoPage | null> {
    if (!Number.isFinite(id)) return null;
    const a = await this.articles.findOne({ where: { id } });
    if (!a) return null;
    const author = await this.users.findOne({ where: { id: a.user_id } });
    const summary = this.excerpt(a.summary || a.content, 180);
    return {
      title: a.title,
      description: summary || DEFAULT_DESCRIPTION,
      path: `/article/${a.id}`,
      image: this.publicUrl(a.cover || this.firstImageFromText(a.content)),
      author: author?.nickname || author?.username,
      publishedAt: a.created_at,
      schemaType: 'Article',
      section: a.category || '专栏',
      stats: `${a.views} 浏览 · ${a.like_count} 赞 · ${a.comment_count} 评论`,
    };
  }

  async thread(id: number): Promise<SeoPage | null> {
    if (!Number.isFinite(id)) return null;
    const t = await this.threads.findOne({ where: { id } });
    if (!t) return null;
    const board = await this.boards.findOne({ where: { id: t.board_id } });
    if (board?.is_paid) return null;
    const author = await this.users.findOne({ where: { id: t.user_id } });
    const media = this.parseMedia(t.media);
    return {
      title: t.title,
      description: this.excerpt(t.content, 180) || DEFAULT_DESCRIPTION,
      path: `/thread/${t.id}`,
      image: this.firstMediaImage(media) || this.publicUrl(board?.cover || ''),
      author: author?.nickname || author?.username,
      publishedAt: t.created_at,
      modifiedAt: t.last_reply_at,
      schemaType: 'Article',
      section: board?.name || '论坛',
      stats: `${t.views} 浏览 · ${t.like_count} 赞 · ${t.reply_count} 回复`,
    };
  }

  async question(id: number): Promise<SeoPage | null> {
    if (!Number.isFinite(id)) return null;
    const q = await this.questions.findOne({ where: { id } });
    if (!q) return null;
    const author = await this.users.findOne({ where: { id: q.user_id } });
    return {
      title: q.title,
      description: this.excerpt(q.body, 180) || `${q.category} 问答，已有 ${q.answer_count} 个回答。`,
      path: `/qa/${q.id}`,
      image: this.publicUrl(author?.avatar || ''),
      author: author?.nickname || author?.username,
      publishedAt: q.created_at,
      schemaType: 'Question',
      section: q.category || '问答',
      stats: `${q.view_count} 浏览 · ${q.answer_count} 回答`,
    };
  }

  async circle(slug: string): Promise<SeoPage | null> {
    const c = await this.circles.findOne({ where: { slug: decodeURIComponent(slug || '') } });
    if (!c) return null;
    return {
      title: `${c.name}圈子`,
      description: this.excerpt(c.description, 180) || `${c.category} 圈子，已有 ${c.member_count} 位成员。`,
      path: `/circle/${encodeURIComponent(c.slug || '')}`,
      image: this.publicUrl(c.cover || ''),
      publishedAt: c.created_at,
      schemaType: 'CollectionPage',
      section: c.category || '圈子',
      stats: `${c.member_count} 成员 · ${c.post_count} 动态`,
    };
  }

  async board(slug: string): Promise<SeoPage | null> {
    const b = await this.boards.findOne({ where: { slug: decodeURIComponent(slug || '') } });
    if (!b || b.is_paid) return null;
    return {
      title: `${b.name}论坛`,
      description: this.excerpt(b.description || b.announcement, 180) || `Saotie ${b.name}板块，查看相关帖子与讨论。`,
      path: `/forum/${encodeURIComponent(b.slug)}`,
      image: this.publicUrl(b.cover || ''),
      publishedAt: b.created_at,
      schemaType: 'CollectionPage',
      section: '论坛',
      stats: `${b.thread_count} 帖子`,
    };
  }

  async topic(name: string): Promise<SeoPage | null> {
    const topicName = decodeURIComponent(name || '').replace(/^#|#$/g, '');
    const t = await this.topics.findOne({ where: { name: topicName } });
    if (!t) return null;
    return {
      title: `#${t.name}#`,
      description: this.excerpt(t.description, 180) || `查看 Saotie 上关于 #${t.name}# 的动态与讨论。`,
      path: `/topic/${encodeURIComponent(t.name)}`,
      image: this.publicUrl(t.cover || ''),
      publishedAt: t.created_at,
      schemaType: 'CollectionPage',
      section: '话题',
      stats: `${t.post_count} 动态 · 热度 ${t.hot}`,
    };
  }

  async profile(username: string): Promise<SeoPage | null> {
    const u = await this.users.findOne({ where: { username: decodeURIComponent(username || '') } });
    if (!u || u.banned) return null;
    const postCount = await this.posts.count({ where: { user_id: u.id, visibility: 'public' } });
    return {
      title: `${u.nickname}（@${u.username}）`,
      description: this.excerpt(u.bio, 180) || `${u.nickname} 在 Saotie 的个人主页，分享动态、帖子和观点。`,
      path: `/u/${encodeURIComponent(u.username)}`,
      image: this.publicUrl(u.avatar || u.cover || ''),
      author: u.nickname || u.username,
      publishedAt: u.created_at,
      modifiedAt: u.updated_at,
      schemaType: 'ProfilePage',
      section: '个人主页',
      stats: `${postCount} 条公开动态`,
    };
  }

  renderPage(page: SeoPage, opts: { noindex?: boolean } = {}) {
    const url = this.baseUrl() + page.path;
    const title = `${page.title} - ${SITE_NAME}`;
    const description = page.description || DEFAULT_DESCRIPTION;
    const image = this.publicUrl(page.image || '');
    const jsonLd = this.jsonLd(page, url, image);
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.html(title)}</title>
  <meta name="description" content="${this.html(description)}">
  <meta name="robots" content="${opts.noindex ? 'noindex,nofollow' : 'index,follow'}">
  <link rel="canonical" href="${this.html(url)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:type" content="${page.schemaType === 'ProfilePage' ? 'profile' : 'article'}">
  <meta property="og:title" content="${this.html(title)}">
  <meta property="og:description" content="${this.html(description)}">
  <meta property="og:url" content="${this.html(url)}">
  ${image ? `<meta property="og:image" content="${this.html(image)}">` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    body{margin:0;background:#f6f7fb;color:#171923;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.72}
    main{max-width:760px;margin:0 auto;padding:48px 20px}
    .card{background:#fff;border:1px solid #e6e8ef;border-radius:16px;padding:28px;box-shadow:0 12px 30px rgba(15,23,42,.08)}
    h1{font-size:28px;line-height:1.25;margin:0 0 14px}.desc{font-size:16px;color:#4b5563;margin:0 0 20px}.meta{font-size:13px;color:#6b7280;margin-bottom:18px}
    img{width:100%;max-height:360px;object-fit:cover;border-radius:12px;margin:6px 0 18px}.open{display:inline-block;color:#fff;background:#2b54f0;border-radius:999px;padding:9px 16px;text-decoration:none;font-weight:700}
  </style>
</head>
<body>
  <main>
    <article class="card">
      ${image ? `<img src="${this.html(image)}" alt="">` : ''}
      <div class="meta">${this.html([page.section, page.author, this.dateOnly(page.publishedAt || ''), page.stats].filter(Boolean).join(' · '))}</div>
      <h1>${this.html(page.title)}</h1>
      <p class="desc">${this.html(description)}</p>
      <a class="open" href="${this.html(url)}">打开 Saotie 查看详情</a>
    </article>
  </main>
</body>
</html>`;
  }

  private async publicThreads(limit: number) {
    return this.threads
      .createQueryBuilder('t')
      .leftJoin(Board, 'b', 'b.id = t.board_id')
      .where('COALESCE(b.is_paid, 0) = 0')
      .orderBy('t.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }

  private jsonLd(page: SeoPage, url: string, image: string) {
    const type = page.schemaType || 'WebPage';
    const data: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': type,
      name: page.title,
      headline: page.title,
      description: page.description,
      url,
      inLanguage: 'zh-CN',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: this.baseUrl() },
    };
    if (image) data.image = [image];
    if (page.author) data.author = { '@type': 'Person', name: page.author };
    if (page.publishedAt) data.datePublished = this.isoDate(page.publishedAt);
    if (page.modifiedAt || page.publishedAt) data.dateModified = this.isoDate(page.modifiedAt || page.publishedAt);
    return JSON.stringify(data).replace(/</g, '\\u003c');
  }

  private isPublicPost(p: Post) {
    return p.visibility === 'public' && !p.password && Number(p.price || 0) <= 0;
  }

  private mediaLabel(type: string) {
    if (type === 'image') return '图片';
    if (type === 'video') return '视频';
    if (type === 'audio') return '音频';
    return '';
  }

  private parseMedia(raw: string) {
    try {
      const arr = JSON.parse(raw || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  private firstMediaImage(media: any[]) {
    for (const item of media || []) {
      const url = item?.type === 'video'
        ? item.poster || item.cover
        : item?.type === 'audio'
          ? item.cover
          : item?.url || item?.cover || item?.poster;
      if (url) return this.publicUrl(String(url));
    }
    return '';
  }

  private firstImageFromText(text: string) {
    const md = String(text || '').match(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/);
    if (md?.[1]) return md[1];
    const html = String(text || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return html?.[1] || '';
  }

  private excerpt(input: string, max: number) {
    const plain = String(input || '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#>*_`~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.length > max ? `${plain.slice(0, max).trim()}...` : plain;
  }

  private publicUrl(value: string) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return `https:${url}`;
    return `${this.baseUrl()}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private baseUrl() {
    return (process.env.SEO_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.SITE_URL || process.env.APP_URL || 'https://saotie.com').replace(/\/+$/, '');
  }

  private dateOnly(value: string) {
    return String(value || '').slice(0, 10);
  }

  private isoDate(value: string | null | undefined) {
    if (!value) return undefined;
    const text = String(value).replace(' ', 'T');
    const date = new Date(text.length <= 10 ? `${text}T00:00:00+08:00` : `${text}+08:00`);
    return Number.isFinite(date.getTime()) ? date.toISOString() : value;
  }

  private html(value: string) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private xml(value: string) {
    return this.html(value);
  }
}
