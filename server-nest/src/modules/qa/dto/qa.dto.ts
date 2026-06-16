import { IsOptional, IsString } from 'class-validator';

export class AskQuestionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  bounty?: number;
}

export class AnswerDto {
  @IsOptional()
  @IsString()
  content?: string;
}
