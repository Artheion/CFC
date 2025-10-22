import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChickenDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
