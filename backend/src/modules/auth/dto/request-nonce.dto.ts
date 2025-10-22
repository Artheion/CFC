import { IsNotEmpty, IsString } from 'class-validator';

export class RequestNonceDto {
  @IsString()
  @IsNotEmpty()
  walletAddress!: string;
}
