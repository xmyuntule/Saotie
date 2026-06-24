import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  verified?: boolean;

  @IsOptional()
  vip?: boolean;

  @IsOptional()
  vipLevel?: number;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  banned?: boolean;

  @IsOptional()
  @IsString()
  verifiedNote?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  points?: number;
}

export class CreateBoardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  parentId?: number;

  @IsOptional()
  @IsString()
  announcement?: string;

  @IsOptional()
  isPaid?: boolean;

  @IsOptional()
  price?: number;
}

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  announcement?: string;

  @IsOptional()
  isPaid?: boolean;

  @IsOptional()
  price?: number;

  @IsOptional()
  sort?: number;
}

export class AddModeratorDto {
  @IsOptional()
  @IsString()
  username?: string;
}

export class CreateTopicDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  payload?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  stock?: number;
}
