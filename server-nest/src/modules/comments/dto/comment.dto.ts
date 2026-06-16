import { IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsOptional()
  postId?: number;

  @IsOptional()
  threadId?: number;

  @IsOptional()
  parentId?: number;

  @IsOptional()
  replyTo?: number;

  @IsOptional()
  @IsString()
  content?: string;
}
