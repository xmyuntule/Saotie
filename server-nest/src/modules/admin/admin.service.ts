import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like as TypeOrmLike, Repository } from 'typeorm';
import {
  Board,
  Comment,
  Moderator,
  Post,
  Product,
  Report,
  Thread,
  Topic,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import {
  AddModeratorDto,
  CreateBoardDto,
  CreateProductDto,
  CreateTopicDto,
  UpdateBoardDto,
  UpdateUserDto,
} from './dto/admin.dto';

/**
 * Ported from server/src/routes/admin.js. Admin-only (AdminGuard). Site
 * overview, user management, board/topic/product CRUD, moderators, reports,
 * and content deletion. Daily counts match a day via a LIKE 'YYYY-MM-DD%'
 * prefix (timestamps are stored as sortable strings) so it is portable.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Thread) private readonly threads: Repository<Thread>,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(Board) private readonly boards: Repository<Board>,
    @InjectRepository(Moderator)
    private readonly moderators: Repository<Moderator>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly helpers: HelpersService,
  ) {}

  private dayCount(repo: Repository<any>, day: string) {
    return repo.count({ where: { created_at: TypeOrmLike(`${day}%`) } });
  }

  // ---- GET /api/admin/overview ----
  async overview() {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
        .toISOString()
        .slice(0, 10);
      days.push({
        date: d,
        posts: await this.dayCount(this.posts, d),
        comments: await this.dayCount(this.comments, d),
        users: await this.dayCount(this.users, d),
      });
    }
    const recentUserRows = await this.users.find({
      order: { id: 'DESC' },
      take: 5,
    });
    const recentUsers: any[] = [];
    for (const u of recentUserRows)
      recentUsers.push(await this.helpers.publicUser(u));
    return {
      stats: {
        users: await this.users.count(),
        posts: await this.posts.count(),
        threads: await this.threads.count(),
        comments: await this.comments.count(),
        topics: await this.topics.count(),
        boards: await this.boards.count(),
        reports: await this.reports.count({ where: { status: 'open' } }),
        vip: await this.users.count({ where: { vip: 1 } }),
      },
      activity: days,
      recentUsers,
    };
  }

  // ---- GET /api/admin/users ----
  async listUsers(q: string) {
    const like = `%${(q || '').trim()}%`;
    const rows = await this.users
      .createQueryBuilder('u')
      .where('u.nickname LIKE :like OR u.username LIKE :like', { like })
      .orderBy('u.id', 'DESC')
      .limit(100)
      .getMany();
    const users: any[] = [];
    for (const u of rows)
      users.push({ ...(await this.helpers.publicUser(u)), email: u.email });
    return { users };
  }

  // ---- PUT /api/admin/users/:id ----
  async updateUser(id: number, dto: UpdateUserDto) {
    const u = await this.helpers.getUser(id);
    if (!u) throw new NotFoundException('用户不存在');
    const patch: Partial<User> = {};
    if (dto.verified !== undefined) patch.verified = dto.verified ? 1 : 0;
    if (dto.vip !== undefined) patch.vip = dto.vip ? 1 : 0;
    if (dto.role != null) patch.role = dto.role;
    if (dto.banned !== undefined) patch.banned = dto.banned ? 1 : 0;
    if (dto.verifiedNote != null) patch.verified_note = dto.verifiedNote;
    if (dto.title != null) patch.title = dto.title;
    if (dto.points != null) patch.points = dto.points;
    if (Object.keys(patch).length)
      await this.users.update({ id: u.id }, patch);
    if (dto.verified)
      await this.helpers.notify({
        userId: u.id,
        actorId: null,
        type: 'system',
        preview: '恭喜！你已获得官方 V 认证 ✅',
      });
    return { user: await this.helpers.publicUser(await this.helpers.getUser(u.id)) };
  }

  // ---- POST /api/admin/boards ----
  async createBoard(dto: CreateBoardDto) {
    const {
      name,
      slug,
      description = '',
      icon = '📁',
      parentId = null,
      announcement = '',
    } = dto;
    if (!name || !slug)
      throw new BadRequestException('板块名称和 slug 必填');
    if (await this.boards.findOne({ where: { slug } }))
      throw new ConflictException('slug 已存在');
    const saved = await this.boards.save(
      this.boards.create({
        parent_id: parentId || null,
        name,
        slug,
        description,
        icon,
        announcement,
        is_paid: dto.isPaid ? 1 : 0,
        price: dto.price ?? 0,
        created_at: this.helpers.nowSql(),
      }),
    );
    return { board: await this.boards.findOne({ where: { id: saved.id } }) };
  }

  // ---- PUT /api/admin/boards/:id ----
  async updateBoard(id: number, dto: UpdateBoardDto) {
    const b = await this.boards.findOne({ where: { id } });
    if (!b) throw new NotFoundException('板块不存在');
    const patch: Partial<Board> = {};
    if (dto.name != null) patch.name = dto.name;
    if (dto.description != null) patch.description = dto.description;
    if (dto.icon != null) patch.icon = dto.icon;
    if (dto.announcement != null) patch.announcement = dto.announcement;
    if (dto.isPaid !== undefined) patch.is_paid = dto.isPaid ? 1 : 0;
    if (dto.price != null) patch.price = dto.price;
    if (dto.sort != null) patch.sort = dto.sort;
    if (Object.keys(patch).length)
      await this.boards.update({ id: b.id }, patch);
    return { ok: true };
  }

  // ---- DELETE /api/admin/boards/:id ----
  async deleteBoard(id: number) {
    await this.boards.delete({ id });
    return { ok: true };
  }

  // ---- POST /api/admin/boards/:id/moderators ----
  async toggleModerator(boardId: number, actor: User, dto: AddModeratorDto) {
    const u = await this.users
      .createQueryBuilder('u')
      .where('u.username = :name OR u.nickname = :name', {
        name: dto.username,
      })
      .getOne();
    if (!u) throw new NotFoundException('用户不存在');
    const exists = await this.moderators.findOne({
      where: { board_id: boardId, user_id: u.id },
    });
    if (exists) {
      await this.moderators.delete({ board_id: boardId, user_id: u.id });
      return { added: false };
    }
    await this.moderators.insert({ board_id: boardId, user_id: u.id });
    await this.helpers.notify({
      userId: u.id,
      actorId: actor.id,
      type: 'system',
      preview: '你已被任命为板块版主 🛡️',
    });
    return { added: true, user: await this.helpers.publicUser(u) };
  }

  // ---- POST /api/admin/topics ----
  async createTopic(dto: CreateTopicDto) {
    const { name, description = '' } = dto;
    if (!name) throw new BadRequestException('话题名必填');
    if (await this.topics.findOne({ where: { name } }))
      throw new ConflictException('话题已存在');
    const saved = await this.topics.save(
      this.topics.create({
        name,
        description,
        hot: 50,
        created_at: this.helpers.nowSql(),
      }),
    );
    return { topic: await this.topics.findOne({ where: { id: saved.id } }) };
  }

  // ---- DELETE /api/admin/topics/:id ----
  async deleteTopic(id: number) {
    await this.topics.delete({ id });
    return { ok: true };
  }

  private async reportTarget(type: string, id: number) {
    if (type === 'post') {
      const p = await this.posts.findOne({ where: { id } });
      return p
        ? {
            exists: true,
            text: (p.content || '(无文字)').slice(0, 80),
            author: await this.helpers.publicUser(
              await this.helpers.getUser(p.user_id),
            ),
          }
        : { exists: false };
    }
    if (type === 'thread') {
      const t = await this.threads.findOne({ where: { id } });
      return t
        ? {
            exists: true,
            text: t.title,
            author: await this.helpers.publicUser(
              await this.helpers.getUser(t.user_id),
            ),
          }
        : { exists: false };
    }
    if (type === 'comment') {
      const c = await this.comments.findOne({ where: { id } });
      return c
        ? {
            exists: true,
            text: (c.content || '').slice(0, 80),
            author: await this.helpers.publicUser(
              await this.helpers.getUser(c.user_id),
            ),
          }
        : { exists: false };
    }
    if (type === 'user') {
      const u = await this.helpers.getUser(id);
      return u
        ? {
            exists: true,
            text: `@${u.username}`,
            author: await this.helpers.publicUser(u),
          }
        : { exists: false };
    }
    return { exists: false };
  }

  // ---- GET /api/admin/reports ----
  async listReports() {
    const rows = await this.reports.find({
      where: { status: 'open' },
      order: { created_at: 'DESC' },
      take: 100,
    });
    const reports: any[] = [];
    for (const r of rows) {
      reports.push({
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        createdAt: r.created_at,
        reporter: await this.helpers.publicUser(
          await this.helpers.getUser(r.reporter_id),
        ),
        target: await this.reportTarget(r.target_type, r.target_id),
      });
    }
    return { reports };
  }

  // ---- POST /api/admin/reports/:id/resolve ----
  async resolveReport(id: number) {
    await this.reports.update({ id }, { status: 'resolved' });
    return { ok: true };
  }

  // ---- POST /api/admin/products ----
  async createProduct(dto: CreateProductDto) {
    const {
      name,
      description = '',
      icon = '🎁',
      category = 'item',
      payload = '',
      price,
      stock = -1,
    } = dto;
    if (!name || !price) throw new BadRequestException('名称和价格必填');
    const saved = await this.products.save(
      this.products.create({
        name,
        description,
        icon,
        category,
        payload,
        price,
        stock,
        created_at: this.helpers.nowSql(),
      }),
    );
    return { product: await this.products.findOne({ where: { id: saved.id } }) };
  }

  // ---- DELETE /api/admin/products/:id ----
  async deleteProduct(id: number) {
    await this.products.delete({ id });
    return { ok: true };
  }

  // ---- DELETE /api/admin/content/:type/:id ----
  async deleteContent(type: string, id: number) {
    const repo: Record<string, Repository<any>> = {
      post: this.posts,
      thread: this.threads,
      comment: this.comments,
    };
    const r = repo[type];
    if (!r) throw new BadRequestException('未知类型');
    await r.delete({ id });
    return { ok: true };
  }
}
