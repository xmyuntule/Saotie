import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, Post, Question, Thread, ViewHistory } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';

/** Ported from server/src/routes/history.js — 浏览足迹(解析成卡片, 已删内容自动剔除). */
@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(ViewHistory) private readonly history: Repository<ViewHistory>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Thread) private readonly threads: Repository<Thread>,
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    private readonly helpers: HelpersService,
  ) {}

  private async resolve(row: ViewHistory, viewerId: number) {
    const base = { type: row.target_type, id: row.target_id, viewedAt: row.viewed_at };
    if (row.target_type === 'post') {
      const p = await this.posts.findOne({ where: { id: row.target_id } });
      if (!p) return null;
      const text = (p.content || '').replace(/[#@]/g, '').trim();
      return { ...base, typeLabel: '动态', icon: 'comment', link: `/post/${p.id}`,
        title: text ? text.slice(0, 60) : '[图片 / 视频]', author: await this.helpers.publicUser(await this.helpers.getUser(p.user_id), viewerId) };
    }
    if (row.target_type === 'thread') {
      const t = await this.threads.findOne({ where: { id: row.target_id } });
      if (!t) return null;
      return { ...base, typeLabel: '帖子', icon: 'forum', link: `/thread/${t.id}`,
        title: t.title, author: await this.helpers.publicUser(await this.helpers.getUser(t.user_id), viewerId) };
    }
    if (row.target_type === 'article') {
      const a = await this.articles.findOne({ where: { id: row.target_id } });
      if (!a) return null;
      return { ...base, typeLabel: '专栏', icon: 'book', link: `/article/${a.id}`, cover: a.cover || '',
        title: a.title, author: await this.helpers.publicUser(await this.helpers.getUser(a.user_id), viewerId) };
    }
    if (row.target_type === 'question') {
      const q = await this.questions.findOne({ where: { id: row.target_id } });
      if (!q) return null;
      return { ...base, typeLabel: '问答', icon: 'help', link: `/qa/${q.id}`, solved: q.status === 'solved',
        title: q.title, author: await this.helpers.publicUser(await this.helpers.getUser(q.user_id), viewerId) };
    }
    return null;
  }

  // GET /api/history
  async list(userId: number) {
    const rows = await this.history.find({
      where: { user_id: userId },
      order: { viewed_at: 'DESC' },
      take: 80,
    });
    const items = (await Promise.all(rows.map((r) => this.resolve(r, userId)))).filter(Boolean);
    return { items };
  }

  // DELETE /api/history/:type/:id
  async removeOne(userId: number, type: string, id: number) {
    await this.history.delete({ user_id: userId, target_type: type, target_id: id });
    return { ok: true };
  }

  // DELETE /api/history
  async clear(userId: number) {
    await this.history.delete({ user_id: userId });
    return { ok: true };
  }
}
