import { IsOptional, IsString } from 'class-validator';

export class CreateFeedbackDto {
  @IsOptional()
  @IsString()
  content?: string;
}

export class ReplyFeedbackDto {
  @IsOptional()
  @IsString()
  reply?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
