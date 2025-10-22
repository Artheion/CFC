import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ApplyReferralDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9\-]{6,32}$/)
  code!: string;
}
