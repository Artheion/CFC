import { IsNotEmpty, IsUUID, IsString, IsOptional } from 'class-validator';

export class JoinFightDto {
  @IsUUID()
  @IsNotEmpty()
  cockId!: string;

  @IsString()
  @IsOptional()
  paymentSignature?: string;
}
