import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/report.dto';

/**
 * /api/reports — submit a report. Mirrors server/src/routes/reports.js.
 */
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }
}
