import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertExternalSyncSourceDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(2000)
  rssUrl: string;

  @IsInt()
  @Min(1)
  userId: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  targetType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  boardId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  template?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  maxImages?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1440)
  fetchIntervalMin?: number;
}

export class UpsertMyExternalSyncSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsString()
  @MaxLength(2000)
  rssUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  template?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  maxImages?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1440)
  fetchIntervalMin?: number;
}
