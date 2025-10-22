import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePricesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  rouletteCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capsulePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medkitPrice?: number;
}
