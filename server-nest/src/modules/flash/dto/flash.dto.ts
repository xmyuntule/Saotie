import { IsOptional, IsString } from 'class-validator';

export class CreateFlashDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  pinned?: number | boolean;
}
