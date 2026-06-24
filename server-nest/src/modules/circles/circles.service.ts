import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Circle,
  CircleMember,
  CircleMessage,
  Post,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { PostsService } from '../posts/posts.service';
import { CreateCircleDto } from './dto/circle.dto';

const slugify = (s: string) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `c-${Date.now()}`;

/**
 * Ported from server/src/routes/circles.js. Interest communities — list /
 * suggestions / detail / feed / create / join / leave. Reuses serializePost.
 */
@Injectable()
export class CirclesService {
  constructor(
    @InjectRepository(Circle) private readonly circles: Repository<Circle>,
    @InjectRepository(CircleMember)
    private readonly members: Repository<CircleMember>,
    @InjectRepository(CircleMessage)
    private readonly chatMessages: Repository<CircleMessage>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly helpers: HelpersService,
    private readonly postsService: PostsService,
  ) {}

  private async serializeCircle(row: Circle, viewerId: number | null) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      color: row.color,
      icon: row.icon,
      cover: row.cover,
      memberCount: row.member_count,
      postCount: row.post_count,
      createdAt: row.created_at,
      owner: row.owner_id
        ? await this.helpers.publicUser(
            await this.helpers.getUser(row.owner_id),
            viewerId,
          )
        : null,
      joined: viewerId
        ? !!(await this.members.findOne({
            where: { circle_id: row.id, user_id: viewerId },
          }))
        : false,
    };
  }

  private async findBySlugOrId(slug: string): Promise<Circle | null> {
    return /^\d+$/.test(slug)
      ? this.circles.findOne({ where: { id: Number(slug) } })
      : this.circles.findOne({ where: { slug } });
  }

  // ---- GET /api/circles ----
  async list(
    category: string | undefined,
    sort: string | undefined,
    mine: string | undefined,
    viewer: User | null,
  ) {
    const viewerId = viewer?.id || null;
    if (mine && viewerId) {
      const rows: Circle[] = await this.circles
        .createQueryBuilder('c')
        .innerJoin(CircleMember, 'm', 'm.circle_id = c.id')
        .where('m.user_id = :uid', { uid: viewerId })
        .orderBy('m.joined_at', 'DESC')
        .getMany();
      const circles: any[] = [];
      for (const r of rows)
        circles.push(await this.serializeCircle(r, viewerId));
      return { circles };
    }
    let qb = this.circles.createQueryBuilder('c');
    if (category) qb = qb.where('c.category = :category', { category });
    if (sort === 'new') qb = qb.orderBy('c.created_at', 'DESC');
    else
      qb = qb
        .orderBy('c.member_count', 'DESC')
        .addOrderBy('c.post_count', 'DESC');
    const rows = await qb.getMany();
    const circles: any[] = [];
    for (const r of rows) circles.push(await this.serializeCircle(r, viewerId));
    return { circles };
  }

  // ---- GET /api/circles/suggestions ----
  async suggestions(viewer: User | null) {
    const viewerId = viewer?.id || null;
    const rows = await this.circles.find({
      order: { member_count: 'DESC', post_count: 'DESC' },
      take: 12,
    });
    const out: any[] = [];
    for (const r of rows) {
      const c = await this.serializeCircle(r, viewerId);
      if (!c.joined) out.push(c);
    }
    return { circles: out.slice(0, 5) };
  }

  // ---- GET /api/circles/:slug ----
  async detail(slug: string, viewer: User | null) {
    const row = await this.findBySlugOrId(slug);
    if (!row) throw new NotFoundException('圈子不存在');
    const memberRows: { id: number }[] = await this.members
      .createQueryBuilder('m')
      .innerJoin(User, 'u', 'u.id = m.user_id')
      .select('u.id', 'id')
      .where('m.circle_id = :cid', { cid: row.id })
      .orderBy("CASE WHEN m.role = 'owner' THEN 1 ELSE 0 END", 'DESC')
      .addOrderBy('m.joined_at', 'ASC')
      .limit(12)
      .getRawMany();
    const members: any[] = [];
    for (const m of memberRows)
      members.push(
        await this.helpers.publicUser(
          await this.helpers.getUser(Number(m.id)),
          viewer?.id || null,
        ),
      );
    return {
      circle: await this.serializeCircle(row, viewer?.id || null),
      members,
    };
  }

  // ---- GET /api/circles/:slug/posts ----
  async feed(
    slug: string,
    rawLimit: any,
    rawOffset: any,
    viewer: User | null,
  ) {
    const row = await this.findBySlugOrId(slug);
    if (!row) throw new NotFoundException('圈子不存在');
    const limit = Math.min(30, Math.max(1, Number(rawLimit) || 20));
    const offset = Math.max(0, Number(rawOffset) || 0);
    const rows = await this.posts
      .createQueryBuilder('p')
      .where('p.circle_id = :cid', { cid: row.id })
      .andWhere("p.visibility != 'private'")
      .orderBy('p.pinned', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();
    const posts: any[] = [];
    for (const r of rows) {
      const s = await this.postsService.serializePost(r, viewer?.id || null);
      if (s) posts.push(s);
    }
    return { posts };
  }

  // ---- POST /api/circles ----
  async create(user: User, dto: CreateCircleDto) {
    let name = (dto.name || '').trim();
    const description = dto.description || '';
    const category = dto.category || '兴趣';
    const color = dto.color || '';
    const icon = dto.icon || 'circle';
    if (!name) throw new BadRequestException('圈子名称必填');
    if (name.length > 24) throw new BadRequestException('圈子名称最多 24 字');
    if (checkSensitive(name) || checkSensitive(description))
      throw new BadRequestException('内容包含敏感信息，请修改后重试');
    let slug = slugify(name);
    if (await this.circles.findOne({ where: { slug } }))
      slug = `${slug}-${Date.now().toString(36)}`;
    const saved = await this.circles.save(
      this.circles.create({
        name,
        slug,
        description: description.slice(0, 200),
        category,
        color,
        icon,
        owner_id: user.id,
        member_count: 1,
        created_at: this.helpers.nowSql(),
      }),
    );
    await this.members.insert({
      circle_id: saved.id,
      user_id: user.id,
      role: 'owner',
      joined_at: this.helpers.nowSql(),
    });
    const row = await this.circles.findOne({ where: { id: saved.id } });
    return { circle: await this.serializeCircle(row!, user.id) };
  }

  // ---- POST /api/circles/:id/join ----
  async join(id: number, user: User) {
    const c = await this.circles.findOne({ where: { id } });
    if (!c) throw new NotFoundException('圈子不存在');
    const already = await this.members.findOne({
      where: { circle_id: id, user_id: user.id },
    });
    if (already) return { joined: true, memberCount: c.member_count };
    await this.members.insert({
      circle_id: id,
      user_id: user.id,
      role: 'member',
      joined_at: this.helpers.nowSql(),
    });
    await this.circles.increment({ id }, 'member_count', 1);
    return { joined: true, memberCount: c.member_count + 1 };
  }

  // ---- POST /api/circles/:id/leave ----
  async leave(id: number, user: User) {
    const c = await this.circles.findOne({ where: { id } });
    if (!c) throw new NotFoundException('圈子不存在');
    if (c.owner_id === user.id)
      throw new BadRequestException('圈主不能退出自己的圈子');
    const info = await this.members.delete({
      circle_id: id,
      user_id: user.id,
    });
    const changed = info.affected || 0;
    if (changed)
      await this.circles
        .query(
          'UPDATE circles SET member_count = GREATEST(0, member_count - 1) WHERE id = ?',
          [id],
        )
        .catch(() =>
          this.circles.query(
            'UPDATE circles SET member_count = GREATEST(0, member_count - 1) WHERE id = $1',
            [id],
          ),
        );
    return {
      joined: false,
      memberCount: Math.max(0, c.member_count - (changed ? 1 : 0)),
    };
  }

  // ---- GET /api/circles/:slug/chat ---- 圈子聊天室（仅成员可读）
  async chatList(slug: string, viewer: User | null) {
    const c = await this.findBySlugOrId(slug);
    if (!c) throw new NotFoundException('圈子不存在');
    const isMember = viewer
      ? !!(await this.members.findOne({
          where: { circle_id: c.id, user_id: viewer.id },
        }))
      : false;
    if (!isMember) return { locked: true, messages: [] };
    const rows = await this.chatMessages.find({
      where: { circle_id: c.id },
      order: { id: 'DESC' },
      take: 100,
    });
    rows.reverse(); // 最旧 → 最新
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const userMap = new Map<number, any>();
    for (const uid of ids)
      userMap.set(
        uid,
        await this.helpers.publicUser(await this.helpers.getUser(uid), viewer!.id),
      );
    const messages = rows.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.created_at,
      author: userMap.get(m.user_id) || null,
    }));
    return { locked: false, messages };
  }

  // ---- POST /api/circles/:slug/chat ---- 发送群聊消息（仅成员）
  async chatSend(slug: string, user: User, contentRaw: string) {
    const c = await this.findBySlugOrId(slug);
    if (!c) throw new NotFoundException('圈子不存在');
    const isMember = !!(await this.members.findOne({
      where: { circle_id: c.id, user_id: user.id },
    }));
    if (!isMember) throw new BadRequestException('加入圈子后才能参与群聊');
    const content = (contentRaw || '').trim();
    if (!content) throw new BadRequestException('说点什么吧');
    if (content.length > 1000) throw new BadRequestException('消息太长了');
    if (checkSensitive(content))
      throw new BadRequestException('内容包含敏感信息，请修改后重试');
    const saved = await this.chatMessages.save(
      this.chatMessages.create({
        circle_id: c.id,
        user_id: user.id,
        content,
        created_at: this.helpers.nowSql(),
      }),
    );
    return {
      message: {
        id: saved.id,
        content: saved.content,
        createdAt: saved.created_at,
        author: await this.helpers.publicUser(
          await this.helpers.getUser(user.id),
          user.id,
        ),
      },
    };
  }

  // ---- DELETE /api/circles/:id （管理员解散圈子：删成员+聊天，圈内动态保留）----
  async adminRemove(user: User, id: number) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const c = await this.circles.findOne({ where: { id } });
    if (!c) throw new NotFoundException('圈子不存在');
    await this.chatMessages.delete({ circle_id: id });
    await this.members.delete({ circle_id: id });
    await this.circles.delete({ id });
    return { ok: true };
  }
}
