import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NavCategory, NavLink, UserNavLink, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { CreateCategoryDto, CreateLinkDto } from './dto/nav.dto';

/**
 * Ported from server/src/routes/nav.js. 网址导航 directory — categories with
 * ordered links, popular links, click tracking, admin create. Shapes match
 * the Express version.
 */
@Injectable()
export class NavService {
  constructor(
    @InjectRepository(NavCategory)
    private readonly categories: Repository<NavCategory>,
    @InjectRepository(NavLink) private readonly links: Repository<NavLink>,
    @InjectRepository(UserNavLink)
    private readonly myLinks: Repository<UserNavLink>,
    private readonly helpers: HelpersService,
  ) {}

  // ---- GET /api/nav ----
  async directory() {
    const cats = await this.categories.find({
      order: { position: 'ASC', id: 'ASC' },
    });
    const categories: any[] = [];
    for (const c of cats) {
      const links = await this.links
        .createQueryBuilder('l')
        .select([
          'l.id',
          'l.title',
          'l.url',
          'l.description',
          'l.color',
          'l.clicks',
        ])
        .where('l.category_id = :cid', { cid: c.id })
        .orderBy('l.position', 'ASC')
        .addOrderBy('l.clicks', 'DESC')
        .addOrderBy('l.id', 'ASC')
        .getMany();
      categories.push({
        id: c.id,
        name: c.name,
        icon: c.icon,
        links,
      });
    }
    return { categories };
  }

  // ---- GET /api/nav/popular ----
  async popular() {
    const rows = await this.links
      .createQueryBuilder('l')
      .select(['l.id', 'l.title', 'l.url', 'l.color', 'l.clicks'])
      .orderBy('l.clicks', 'DESC')
      .addOrderBy('l.id', 'ASC')
      .limit(8)
      .getMany();
    return { links: rows };
  }

  // ---- POST /api/nav/:id/click ----
  async click(id: number) {
    await this.links.increment({ id }, 'clicks', 1);
    return { ok: true };
  }

  // ---- POST /api/nav/categories ----
  async createCategory(user: User, dto: CreateCategoryDto) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const name = (dto.name || '').trim();
    const icon = dto.icon || 'compass';
    const position = dto.position ?? 0;
    if (!name) throw new BadRequestException('分类名必填');
    const saved = await this.categories.save(
      this.categories.create({ name: name.slice(0, 20), icon, position }),
    );
    return { ok: true, id: saved.id };
  }

  // ---- POST /api/nav/links ----
  async createLink(user: User, dto: CreateLinkDto) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const { categoryId } = dto;
    const title = (dto.title || '').trim();
    const url = (dto.url || '').trim();
    const description = dto.description || '';
    const color = dto.color || '';
    const position = dto.position ?? 0;
    if (!categoryId || !title || !url)
      throw new BadRequestException('分类 / 标题 / 链接必填');
    if (checkSensitive(title) || checkSensitive(description))
      throw new BadRequestException('内容包含敏感信息');
    const saved = await this.links.save(
      this.links.create({
        category_id: categoryId,
        title: title.slice(0, 40),
        url: url.slice(0, 300),
        description: description.slice(0, 120),
        color,
        position,
        created_at: this.helpers.nowSql(),
      }),
    );
    return { ok: true, id: saved.id };
  }

  // ---- DELETE /api/nav/categories/:id （仅管理员，连同其下链接一并删除）----
  async removeCategory(user: User, id: number) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    await this.links.delete({ category_id: id });
    await this.categories.delete({ id });
    return { ok: true };
  }

  // ---- DELETE /api/nav/links/:id （仅管理员）----
  async removeLink(user: User, id: number) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    await this.links.delete({ id });
    return { ok: true };
  }

  // ===== 个人网址收藏夹（每个用户自己的常用网址）=====

  // ---- GET /api/nav/mine ----
  async myDirectory(user: User) {
    const rows = await this.myLinks.find({
      where: { user_id: user.id },
      order: { id: 'DESC' },
    });
    return {
      links: rows.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        description: r.description,
      })),
    };
  }

  // ---- POST /api/nav/mine ----
  async addMyLink(user: User, dto: { title?: string; url?: string; description?: string }) {
    const title = (dto.title || '').trim();
    let url = (dto.url || '').trim();
    const description = (dto.description || '').trim();
    if (!title || !url) throw new BadRequestException('网站名和链接必填');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url; // 自动补全协议
    if (checkSensitive(title) || checkSensitive(description))
      throw new BadRequestException('内容包含敏感信息');
    const count = await this.myLinks.count({ where: { user_id: user.id } });
    if (count >= 100) throw new BadRequestException('收藏夹已满（上限 100 个）');
    const saved = await this.myLinks.save(
      this.myLinks.create({
        user_id: user.id,
        title: title.slice(0, 40),
        url: url.slice(0, 300),
        description: description.slice(0, 120),
        created_at: this.helpers.nowSql(),
      }),
    );
    return { ok: true, id: saved.id };
  }

  // ---- DELETE /api/nav/mine/:id （仅本人）----
  async removeMyLink(user: User, id: number) {
    await this.myLinks.delete({ id, user_id: user.id });
    return { ok: true };
  }
}
