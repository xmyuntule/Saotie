import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like as TypeOrmLike, Repository } from 'typeorm';
import { Post, Topic, TopicFollow, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { PostsService } from '../posts/posts.service';

/**
 * Ported from server/src/routes/topics.js. Hot topics, topic follows, and a
 * topic's posts. Reuses PostsService.serializePost for response parity.
 */
@Injectable()
export class TopicsService {
  constructor(
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(TopicFollow)
    private readonly follows: Repository<TopicFollow>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly postsService: PostsService,
    private readonly helpers: HelpersService,
  ) {}

  private async topicMeta(t: Topic, viewerId: number | null) {
    const followers = await this.follows.count({ where: { topic_id: t.id } });
    const isFollowing = viewerId
      ? !!(await this.follows.findOne({
          where: { user_id: viewerId, topic_id: t.id },
        }))
      : false;
    return { ...t, followers, isFollowing };
  }

  private async serializeMany(rows: Post[], viewerId: number | null) {
    const out: any[] = [];
    for (const r of rows) {
      const s = await this.postsService.serializePost(r, viewerId);
      if (s) out.push(s);
    }
    return out;
  }

  // ---- GET /api/topics ----
  // limit 可选：后台管理传更大值（如 100）以浏览/搜索更多话题；前台不传则保留 12/8 默认上限。
  async list(q: string, limit?: number) {
    const query = (q || '').trim();
    // 未传 limit → cap=0 → 走下方 8/12 默认；传了则夹到 [1,200]
    const cap = Math.min(200, Math.max(0, Number(limit) || 0));
    const rows = query
      ? await this.topics.find({
          where: { name: TypeOrmLike(`%${query}%`) },
          order: { hot: 'DESC' },
          take: cap || 8,
        })
      : await this.topics.find({
          order: { hot: 'DESC', post_count: 'DESC' },
          take: cap || 12,
        });
    return { topics: rows };
  }

  // ---- GET /api/topics/following ----
  async following(user: User) {
    const rows: Topic[] = await this.topics
      .createQueryBuilder('t')
      .innerJoin(TopicFollow, 'f', 'f.topic_id = t.id')
      .where('f.user_id = :uid', { uid: user.id })
      .orderBy('f.created_at', 'DESC')
      .getMany();
    const topics: any[] = [];
    for (const t of rows) topics.push(await this.topicMeta(t, user.id));
    return { topics };
  }

  // ---- GET /api/topics/:name ----
  async detail(name: string, viewer: User | null) {
    const t = await this.topics.findOne({ where: { name } });
    if (!t) throw new NotFoundException('话题不存在');
    const rows = await this.posts
      .createQueryBuilder('p')
      .where('p.topic_id = :tid', { tid: t.id })
      .andWhere("p.visibility != 'private'")
      .orderBy('p.created_at', 'DESC')
      .limit(50)
      .getMany();
    return {
      topic: await this.topicMeta(t, viewer?.id || null),
      posts: await this.serializeMany(rows, viewer?.id || null),
    };
  }

  // ---- POST /api/topics/:name/follow ----
  async follow(name: string, user: User) {
    const t = await this.topics.findOne({ where: { name } });
    if (!t) throw new NotFoundException('话题不存在');
    const has = await this.follows.findOne({
      where: { user_id: user.id, topic_id: t.id },
    });
    if (has) {
      await this.follows.delete({ user_id: user.id, topic_id: t.id });
      return { following: false };
    }
    await this.follows.insert({
      user_id: user.id,
      topic_id: t.id,
      created_at: this.helpers.nowSql(),
    });
    return { following: true };
  }
}
