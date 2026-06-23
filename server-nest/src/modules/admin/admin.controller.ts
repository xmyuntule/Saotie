import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import {
  AddModeratorDto,
  CreateBoardDto,
  CreateProductDto,
  CreateTopicDto,
  UpdateBoardDto,
  UpdateUserDto,
} from './dto/admin.dto';

/**
 * /api/admin — admin-only operations. Mirrors server/src/routes/admin.js,
 * which applies requireAuth + requireAdmin to every route; AdminGuard does both.
 */
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('config')
  getConfig() {
    return this.admin.getConfig();
  }

  @Put('config')
  updateConfig(@Body('config') config: Record<string, any>) {
    return this.admin.updateConfig(config || {});
  }

  @Get('users')
  listUsers(@Query('q') q: string) {
    return this.admin.listUsers(q);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(Number(id), dto);
  }

  @Post('boards')
  createBoard(@Body() dto: CreateBoardDto) {
    return this.admin.createBoard(dto);
  }

  @Put('boards/:id')
  updateBoard(@Param('id') id: string, @Body() dto: UpdateBoardDto) {
    return this.admin.updateBoard(Number(id), dto);
  }

  @Delete('boards/:id')
  deleteBoard(@Param('id') id: string) {
    return this.admin.deleteBoard(Number(id));
  }

  @Post('boards/:id/moderators')
  toggleModerator(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: AddModeratorDto,
  ) {
    return this.admin.toggleModerator(Number(id), user, dto);
  }

  @Post('topics')
  createTopic(@Body() dto: CreateTopicDto) {
    return this.admin.createTopic(dto);
  }

  @Delete('topics/:id')
  deleteTopic(@Param('id') id: string) {
    return this.admin.deleteTopic(Number(id));
  }

  @Get('reports')
  listReports() {
    return this.admin.listReports();
  }

  @Post('reports/:id/resolve')
  resolveReport(@Param('id') id: string) {
    return this.admin.resolveReport(Number(id));
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.admin.createProduct(dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.admin.deleteProduct(Number(id));
  }

  @Delete('content/:type/:id')
  deleteContent(@Param('type') type: string, @Param('id') id: string) {
    return this.admin.deleteContent(type, Number(id));
  }
}
