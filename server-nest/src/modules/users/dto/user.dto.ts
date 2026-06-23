import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsString()
  verifiedNote?: string;
}

export class RechargeDto {
  @IsOptional()
  amount?: number;

  @IsOptional()
  vip?: boolean;

  @IsOptional()
  vipLevel?: number; // 1青铜/2黄金/3黑钻；兼容旧 vip:true(=1)
}
