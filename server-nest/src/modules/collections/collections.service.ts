import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Article,
  Collection,
  CollectionItem,
  Post,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { PostsService } from '../posts/posts.service';

const ITEM_TYPES = ['post', 'article'];

/** 内容专题/合集 (Collections)：用户策展一组动态/文章。 */
@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection) private readonly collections: Repository<Collection>,
    @InjectRepository(CollectionItem) private readonly items: Repository<CollectionItem>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    private readonly helpers: HelpersService,
    private readonly postsService: PostsService,
  ) {}

  private async serializeCollection(c: Collection, viewerId: number | null) {
    return {
      id: c.id,
      title: c.title,
      cover: c.cover,
      description: c.description,
      itemCount: c.item_count,
      createdAt: c.created_at,
      owner: await this.helpers.publicUser(
        await this.helpers.getUser(c.user_id),
        viewerId,
      ),
      isOwner: viewerId === c.user_id,
    };
  }

  private async articleCard(a: Article, viewerId: number | null) {
    return {
      type: 'article',
      id: a.id,
      title: a.title,
      cover: a.cover,
      summary: a.summary,
      category: a.category,
      likeCount: a.like_count,
      commentCount: a.comment_count,
      views: a.views,
      createdAt: a.created_at,
      author: await this.helpers.publicUser(
        await this.helpers.getUser(a.user_id),
        viewerId,
      ),
    };
  }

  // ---- GET /api/collections —— 公开专题列表（新→旧）----
  async list(viewer: User | null) {
    const rows = await this.collections.find({
      order: { updated_at: 'DESC', id: 'DESC' },
      take: 50,
    });
    const collections: any[] = [];
    for (const c of rows) collections.push(await this.serializeCollection(c, viewer?.id || null));
    return { collections };
  }

  // ---- GET /api/users/:username 的专题 —— 我/某人的专题（供选择器）----
  async byUser(userId: number, viewer: User | null) {
    const rows = await this.collections.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC', id: 'DESC' },
      take: 100,
    });
    const collections: any[] = [];
    for (const c of rows) collections.push(await this.serializeCollection(c, viewer?.id || null));
    return { collections };
  }

  // ---- GET /api/collections/:id —— 详情 + 已收录条目卡片 ----
  async detail(id: number, viewer: User | null) {
    const c = await this.collections.findOne({ where: { id } });
    if (!c) throw new NotFoundException('专题不存在');
    const viewerId = viewer?.id || null;
    const rows = await this.items.find({
      where: { collection_id: c.id },
      order: { id: 'DESC' },
      take: 100,
    });
    const items: any[] = [];
    for (const it of rows) {
      if (it.target_type === 'post') {
        const p = await this.posts.findOne({ where: { id: it.target_id } });
        if (p) {
          const s = await this.postsService.serializePost(p, viewerId);
          if (s) items.push({ type: 'post', itemId: it.id, ...s });
        }
      } else if (it.target_type === 'article') {
        const a = await this.articles.findOne({ where: { id: it.target_id } });
        if (a) items.push({ itemId: it.id, ...(await this.articleCard(a, viewerId)) });
      }
    }
    return { collection: await this.serializeCollection(c, viewerId), items };
  }

  // ---- POST /api/collections —— 创建 ----
  async create(user: User, b: any) {
    const title = (b?.title || '').trim();
    if (title.length < 2) throw new BadRequestException('专题标题至少 2 个字');
    const description = (b?.description || '').trim();
    if (checkSensitive(title) || checkSensitive(description))
      throw new BadRequestException('内容包含敏感信息，请修改后重试');
    const now = this.helpers.nowSql();
    const saved = await this.collections.save(
      this.collections.create({
        user_id: user.id,
        title: title.slice(0, 80),
        cover: (b?.cover || '').trim().slice(0, 500),
        description: description.slice(0, 300),
        item_count: 0,
        created_at: now,
        updated_at: now,
      }),
    );
    return { collection: await this.serializeCollection(saved, user.id) };
  }

  // ---- POST /api/collections/:id/items —— 收录条目（仅作者）----
  async addItem(id: number, user: User, b: any) {
    const c = await this.collections.findOne({ where: { id } });
    if (!c) throw new NotFoundException('专题不存在');
    if (c.user_id !== user.id) throw new ForbiddenException('只能往自己的专题里添加');
    const targetType = ITEM_TYPES.includes(b?.targetType) ? b.targetType : null;
    const targetId = parseInt(b?.targetId, 10);
    if (!targetType || !targetId) throw new BadRequestException('参数有误');
    // 校验目标存在
    const exists =
      targetType === 'post'
        ? await this.posts.findOne({ where: { id: targetId }, select: ['id', 'media'] })
        : await this.articles.findOne({ where: { id: targetId }, select: ['id', 'cover'] });
    if (!exists) throw new NotFoundException('内容不存在');
    if (await this.items.findOne({ where: { collection_id: c.id, target_type: targetType, target_id: targetId } }))
      throw new BadRequestException('已经收录过啦');
    await this.items.save(
      this.items.create({ collection_id: c.id, target_type: targetType, target_id: targetId, created_at: this.helpers.nowSql() }),
    );
    // 封面兜底：专题没封面时用首个收录条目的图
    let cover = c.cover;
    if (!cover) {
      if (targetType === 'article') cover = (exists as Article).cover || '';
      else {
        try { const m = JSON.parse((exists as Post).media || '[]'); cover = m.find((x: any) => x.type === 'image')?.url || ''; } catch { /* ignore */ }
      }
    }
    await this.collections.update(
      { id: c.id },
      { item_count: c.item_count + 1, cover, updated_at: this.helpers.nowSql() },
    );
    return { ok: true };
  }

  // ---- DELETE /api/collections/:id/items/:itemId —— 移除条目（仅作者）----
  async removeItem(id: number, user: User, itemId: number) {
    const c = await this.collections.findOne({ where: { id } });
    if (!c) throw new NotFoundException('专题不存在');
    if (c.user_id !== user.id) throw new ForbiddenException('无权操作');
    const it = await this.items.findOne({ where: { id: itemId, collection_id: c.id } });
    if (!it) throw new NotFoundException('条目不存在');
    await this.items.delete({ id: it.id });
    await this.collections.update(
      { id: c.id },
      { item_count: Math.max(0, c.item_count - 1), updated_at: this.helpers.nowSql() },
    );
    return { ok: true };
  }

  // ---- DELETE /api/collections/:id —— 删除专题（作者/管理员）----
  async remove(id: number, user: User) {
    const c = await this.collections.findOne({ where: { id } });
    if (!c) throw new NotFoundException('专题不存在');
    if (c.user_id !== user.id && user.role !== 'admin')
      throw new ForbiddenException('无权删除');
    await this.items.delete({ collection_id: c.id });
    await this.collections.delete({ id: c.id });
    return { ok: true };
  }
}
