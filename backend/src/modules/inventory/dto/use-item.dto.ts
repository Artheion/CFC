import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UseItemDto {
  @IsString()
  @IsNotEmpty()
  itemSlug!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(64)
  cockId!: string;
}
