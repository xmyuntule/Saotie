import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { CreateReportDto } from './dto/report.dto';

/**
 * Ported from server/src/routes/reports.js. Submit a 举报. Admin listing /
 * resolution lives in the admin module.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    private readonly helpers: HelpersService,
  ) {}

  // ---- POST /api/reports ----
  async create(user: User, dto: CreateReportDto) {
    const { targetType, targetId, reason = '' } = dto;
    if (
      !['post', 'thread', 'comment', 'user'].includes(targetType || '') ||
      !targetId
    )
      throw new BadRequestException('参数不合法');
    await this.reports.insert({
      reporter_id: user.id,
      target_type: targetType!,
      target_id: targetId,
      reason,
      created_at: this.helpers.nowSql(),
    });
    return { ok: true };
  }
}
