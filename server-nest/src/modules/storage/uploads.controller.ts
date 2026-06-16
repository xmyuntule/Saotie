import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

/**
 * Uploads — POST /api/upload (multipart field "files", up to 9).
 * Mirrors the Express upload route's response: { files: [{url,type,name}] }.
 * Files are streamed to S3-compatible storage (rustfs/MinIO/S3) instead of
 * being written to a local /uploads directory.
 */
@Controller('api/upload')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 9, {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /image\/|video\/|audio\//.test(file.mimetype);
        cb(ok ? null : new Error('仅支持图片、视频、音频'), ok);
      },
    }),
  )
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const uploaded = await this.storage.uploadMany(
      files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
      })),
    );
    // strip the internal `key` from the client-facing response
    return { files: uploaded.map(({ url, type, name }) => ({ url, type, name })) };
  }
}
