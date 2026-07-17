import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { User } from '../../database/entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CertificationsService } from './certifications.service';

@Controller('api/certifications')
export class CertificationsController {
  constructor(private readonly certifications: CertificationsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: User) {
    return this.certifications.mine(user);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype.startsWith('image/');
        cb(ok ? null : new Error('仅支持图片材料'), ok);
      },
    }),
  )
  submit(
    @CurrentUser() user: User,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.certifications.submit(user, body, files || []);
  }
}

@Controller('api/admin/certifications')
@UseGuards(AdminGuard)
export class AdminCertificationsController {
  constructor(private readonly certifications: CertificationsService) {}

  @Get()
  list(
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('offset') offset: string,
  ) {
    return this.certifications.listAdmin(status, type, Number(offset) || 0);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.certifications.detailAdmin(Number(id));
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.certifications.review(Number(id), user, body);
  }
}
