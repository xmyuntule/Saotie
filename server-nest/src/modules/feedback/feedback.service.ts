import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { CreateFeedbackDto, ReplyFeedbackDto } from './dto/feedback.dto';

const STATUSES = ['open', 'planned', 'doing', 'resolved', 'closed'];

/**
 * Ported from server/src/routes/feedback.js. 问题反馈 — submit, list (newest
 * first; replied float to the top under a status filter), and admin reply.
 */
@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedback: Repository<Feedback>,
    private readonly helpers: HelpersService,
  ) {}

  private async serialize(f: Feedback, viewerId: number | null) {
    return {
      id: f.id,
      content: f.content,
      status: f.status || 'open',
      reply: f.reply || '',
      repliedAt: f.replied_at || null,
      createdAt: f.created_at,
      user: f.user_id
        ? await this.helpers.publicUser(
            await this.helpers.getUser(f.user_id),
            viewerId,
          )
        : null,
    };
  }

  // ---- POST /api/feedback ----
  async create(user: User, dto: CreateFeedbackDto) {
    const content = (dto.content || '').trim();
    if (content.length < 5)
      throw new BadRequestException('反馈内容太短，再多写几个字吧');
    if (checkSensitive(content))
      throw new BadRequestException('内容包含敏感信息，请修改后重试');
    const saved = await this.feedback.save(
      this.feedback.create({
        user_id: user.id,
        content: content.slice(0, 500),
        created_at: this.helpers.nowSql(),
      }),
    );
    return { ok: true, id: saved.id };
  }

  // ---- GET /api/feedback ----
  async list(status: string | undefined, viewer: User | null) {
    let qb = this.feedback.createQueryBuilder('f');
    if (status && STATUSES.includes(status)) {
      qb = qb
        .where('f.status = :status', { status })
        .orderBy("CASE WHEN f.reply != '' THEN 1 ELSE 0 END", 'DESC')
        .addOrderBy('f.created_at', 'DESC');
    } else {
      qb = qb.orderBy('f.created_at', 'DESC');
    }
    const rows = await qb.limit(100).getMany();
    const out: any[] = [];
    for (const f of rows)
      out.push(await this.serialize(f, viewer?.id || null));
    return { feedback: out };
  }

  // ---- POST /api/feedback/:id/reply ----
  async reply(id: number, user: User, dto: ReplyFeedbackDto) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const reply = (dto.reply || '').trim().slice(0, 500);
    const status = STATUSES.includes(dto.status || '')
      ? dto.status!
      : 'resolved';
    const f = await this.feedback.findOne({ where: { id } });
    if (!f) throw new NotFoundException('反馈不存在');
    await this.feedback.update(
      { id: f.id },
      { reply, status, replied_at: this.helpers.nowSql() },
    );
    return { ok: true };
  }
}
