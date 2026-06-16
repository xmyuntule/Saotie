import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

/** A poll payload attached at post creation time. */
export class PollInputDto {
  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  multi?: boolean;

  @IsOptional()
  @IsInt()
  days?: number;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  media?: any[];

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  visibility?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  circleId?: number;

  @IsOptional()
  poll?: PollInputDto;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  media?: any[];

  @IsOptional()
  @IsString()
  visibility?: string;

  @IsOptional()
  price?: number;
}

export class VoteDto {
  @IsOptional()
  @IsArray()
  optionIds?: number[];

  @IsOptional()
  optionId?: number;
}

export class ShareDto {
  @IsOptional()
  @IsString()
  content?: string;
}

export class RewardDto {
  @IsOptional()
  amount?: number;
}

export class UnlockDto {
  @IsOptional()
  @IsString()
  password?: string;
}
