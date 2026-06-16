import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flash, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { CreateFlashDto } from './dto/flash.dto';

/**
 * Ported from server/src/routes/flash.js. 资讯快报 / 公告 news feed (public list,
 * admin publish). Response shapes match the Express version.
 */
@Injectable()
export class FlashService {
  constructor(
    @InjectRepository(Flash) private readonly flash: Repository<Flash>,
    private readonly helpers: HelpersService,
  ) {}

  private mapRow(r: Flash) {
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      category: r.category,
      url: r.url,
      pinned: r.pinned,
      createdAt: r.created_at,
    };
  }

  // ---- GET /api/flash ----
  async list(rawLimit: any, category: string | undefined) {
    const limit = Math.min(50, Math.max(1, Number(rawLimit) || 30));
    let qb = this.flash.createQueryBuilder('f');
    if (category) qb = qb.where('f.category = :category', { category });
    const rows = await qb
      .orderBy('f.pinned', 'DESC')
      .addOrderBy('f.created_at', 'DESC')
      .limit(limit)
      .getMany();
    return { flash: rows.map((r) => this.mapRow(r)) };
  }

  // ---- POST /api/flash ----
  async create(user: User, dto: CreateFlashDto) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const title = (dto.title || '').trim();
    const summary = dto.summary || '';
    const category = dto.category || '动态';
    const url = dto.url || '';
    if (!title) throw new BadRequestException('标题必填');
    const saved = await this.flash.save(
      this.flash.create({
        title: title.slice(0, 120),
        summary: summary.slice(0, 300),
        category,
        url: url.slice(0, 300),
        pinned: dto.pinned ? 1 : 0,
        created_at: this.helpers.nowSql(),
      }),
    );
    return { ok: true, id: saved.id };
  }
}
