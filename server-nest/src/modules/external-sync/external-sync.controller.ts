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
import { AdminGuard, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../database/entities';
import {
  UpsertExternalSyncSourceDto,
  UpsertMyExternalSyncSourceDto,
} from './dto';
import { ExternalSyncService } from './external-sync.service';

@Controller('api/external-sync')
export class ExternalSyncController {
  constructor(private readonly service: ExternalSyncService) {}

  @Get('admin')
  @UseGuards(AdminGuard)
  adminIndex() {
    return this.service.adminIndex();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  myIndex(@CurrentUser() user: User) {
    return this.service.myIndex(user);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  upsertMySource(
    @CurrentUser() user: User,
    @Body() dto: UpsertMyExternalSyncSourceDto,
  ) {
    return this.service.upsertMySource(user, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteMySource(@CurrentUser() user: User) {
    return this.service.deleteMySource(user);
  }

  @Post('me/fetch')
  @UseGuards(JwtAuthGuard)
  fetchMySource(@CurrentUser() user: User) {
    return this.service.fetchMySource(user);
  }

  @Post('me/verify')
  @UseGuards(JwtAuthGuard)
  verifyMySource(@CurrentUser() user: User) {
    return this.service.verifyMySource(user);
  }

  @Post('sources')
  @UseGuards(AdminGuard)
  createSource(
    @CurrentUser() user: User,
    @Body() dto: UpsertExternalSyncSourceDto,
  ) {
    return this.service.createSource(user.id, dto);
  }

  @Put('sources/:id')
  @UseGuards(AdminGuard)
  updateSource(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpsertExternalSyncSourceDto,
  ) {
    return this.service.updateSource(user.id, Number(id), dto);
  }

  @Delete('sources/:id')
  @UseGuards(AdminGuard)
  deleteSource(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.deleteSource(user.id, Number(id));
  }

  @Delete('imports')
  @UseGuards(AdminGuard)
  clearImports(@CurrentUser() user: User) {
    return this.service.clearImports(user.id);
  }

  @Post('sources/:id/fetch')
  @UseGuards(AdminGuard)
  fetchSource(@Param('id') id: string) {
    return this.service.fetchSourceNow(Number(id));
  }

  @Post('sources/:id/verify')
  @UseGuards(AdminGuard)
  verifySource(@Param('id') id: string) {
    return this.service.verifySourceNow(Number(id));
  }
}
