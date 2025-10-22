import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateReferralSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earningsSharePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeWheelSpins?: number;
}
