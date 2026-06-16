import { IsOptional, IsString } from 'class-validator';

export class SendAiMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
