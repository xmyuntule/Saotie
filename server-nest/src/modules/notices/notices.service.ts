import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteNotice, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';

const LEVELS = ['info', 'success', 'warning', 'event'];

/** Ported from server/src/routes/notices.js — 全站运营公告. */
@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(SiteNotice) private readonly repo: Repository<SiteNotice>,
    private readonly helpers: HelpersService,
  ) {}

  private serialize(n: SiteNotice) {
    return {
      id: n.id,
      title: n.title,
      body: n.body || '',
      level: LEVELS.includes(n.level) ? n.level : 'info',
      link: n.link || '',
      linkLabel: n.link_label || '',
      active: !!n.active,
      pinned: !!n.pinned,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    };
  }

  // 公开：banner 用的生效公告（置顶优先、最新次之）
  async listPublic() {
    const rows = await this.repo.find({
      where: { active: 1 },
      order: { pinned: 'DESC', created_at: 'DESC' },
      take: 5,
    });
    return { notices: rows.map((n) => this.serialize(n)) };
  }

  // 管理：全部公告
  async listAll() {
    const rows = await this.repo.find({
      order: { pinned: 'DESC', created_at: 'DESC' },
      take: 200,
    });
    return { notices: rows.map((n) => this.serialize(n)) };
  }

  async create(user: User, b: any) {
    const title = (b?.title || '').trim();
    if (title.length < 2) throw new BadRequestException('公告标题太短，再写几个字吧');
    const body = (b?.body || '').trim();
    if (checkSensitive(title) || checkSensitive(body)) throw new BadRequestException('内容包含敏感信息，请修改后重试');
    const level = LEVELS.includes(b?.level) ? b.level : 'info';
    const now = this.helpers.nowSql();
    const saved = await this.repo.save(this.repo.create({
      title: title.slice(0, 120),
      body: body.slice(0, 500),
      level,
      link: (b?.link || '').trim().slice(0, 300),
      link_label: (b?.linkLabel || '').trim().slice(0, 30),
      active: b?.active === false ? 0 : 1,
      pinned: b?.pinned ? 1 : 0,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    }));
    return { ok: true, id: saved.id };
  }

  async update(id: number, b: any) {
    const n = await this.repo.findOne({ where: { id } });
    if (!n) throw new NotFoundException('公告不存在');
    const title = ((b?.title ?? n.title).trim()) || n.title;
    const body = (b?.body ?? n.body) || '';
    if (checkSensitive(title) || checkSensitive(body)) throw new BadRequestException('内容包含敏感信息，请修改后重试');
    n.title = title.slice(0, 120);
    n.body = body.slice(0, 500);
    n.level = LEVELS.includes(b?.level) ? b.level : n.level;
    n.link = (b?.link ?? (n.link || '')).slice(0, 300);
    n.link_label = (b?.linkLabel ?? (n.link_label || '')).slice(0, 30);
    if (b?.active !== undefined) n.active = b.active ? 1 : 0;
    if (b?.pinned !== undefined) n.pinned = b.pinned ? 1 : 0;
    n.updated_at = this.helpers.nowSql();
    await this.repo.save(n);
    return { ok: true };
  }

  async remove(id: number) {
    await this.repo.delete({ id });
    return { ok: true };
  }
}
