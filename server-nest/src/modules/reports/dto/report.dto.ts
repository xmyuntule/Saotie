import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  targetId?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
