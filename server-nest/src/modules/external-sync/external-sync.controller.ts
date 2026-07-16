import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../database/entities';
import { UpsertExternalSyncSourceDto } from './dto';
import { ExternalSyncService } from './external-sync.service';

@Controller('api/external-sync')
@UseGuards(AdminGuard)
export class ExternalSyncController {
  constructor(private readonly service: ExternalSyncService) {}

  @Get('admin')
  adminIndex() {
    return this.service.adminIndex();
  }

  @Post('sources')
  createSource(
    @CurrentUser() user: User,
    @Body() dto: UpsertExternalSyncSourceDto,
  ) {
    return this.service.createSource(user.id, dto);
  }

  @Put('sources/:id')
  updateSource(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpsertExternalSyncSourceDto,
  ) {
    return this.service.updateSource(user.id, Number(id), dto);
  }

  @Delete('sources/:id')
  deleteSource(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.deleteSource(user.id, Number(id));
  }

  @Delete('imports')
  clearImports(@CurrentUser() user: User) {
    return this.service.clearImports(user.id);
  }

  @Post('sources/:id/fetch')
  fetchSource(@Param('id') id: string) {
    return this.service.fetchSourceNow(Number(id));
  }
}
