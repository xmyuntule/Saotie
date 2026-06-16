import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateThreadDto {
  @IsOptional()
  boardId?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  media?: any[];
}

export class UpdateThreadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class ModerateThreadDto {
  @IsOptional()
  @IsString()
  action?: string;
}
