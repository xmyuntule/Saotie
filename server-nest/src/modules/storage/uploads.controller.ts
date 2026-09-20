import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadFilesInterceptor } from './upload-files.interceptor';
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
  @UseInterceptors(UploadFilesInterceptor)
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('purpose') purpose?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const uploaded: { url: string; type: string; name: string; key: string }[] = [];
    for (const file of files) {
      const streamed = (file as Express.Multer.File & { storageUpload?: typeof uploaded[number] }).storageUpload;
      uploaded.push(streamed || await this.storage.upload({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      }, purpose));
    }
    // strip the internal `key` from the client-facing response
    return { files: uploaded.map(({ url, type, name }) => ({ url, type, name })) };
  }
}
