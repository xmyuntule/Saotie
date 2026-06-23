import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CollectionsService } from './collections.service';

/** /api/collections — 内容专题/合集。 */
@Controller('api/collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@CurrentUser() user: User | null) {
    return this.collections.list(user);
  }

  // 我的专题（供"加入专题"选择器）—— 须在 :id 之前
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: User) {
    return this.collections.byUser(user.id, user);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('id') id: string, @CurrentUser() user: User | null) {
    return this.collections.detail(Number(id), user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.collections.create(user, body);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  addItem(@Param('id') id: string, @CurrentUser() user: User, @Body() body: any) {
    return this.collections.addItem(Number(id), user, body);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() user: User) {
    return this.collections.removeItem(Number(id), user, Number(itemId));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.collections.remove(Number(id), user);
  }
}
