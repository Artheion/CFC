import { IsNotEmpty, IsUUID, IsString, IsOptional, Matches } from 'class-validator';

export class JoinFightDto {
  @IsUUID()
  @IsNotEmpty()
  cockId!: string;

  @IsString()
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'Payment signature must be a valid transaction hash (0x + 64 hex characters)',
  })
  paymentSignature?: string; // Transaction hash from CFC token transfer (optional for backward compatibility)
}
