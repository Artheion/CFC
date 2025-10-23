import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsUUID, Max, Min, IsString, IsOptional, Matches } from 'class-validator';

export class CreateFightDto {
  @IsUUID(4, { message: 'Fight ID must be a valid UUID' })
  @IsOptional()
  fightId?: string;

  @IsUUID(4, { message: 'Cock ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Cock ID is required' })
  cockId!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Wager must be a number' })
  @IsPositive({ message: 'Wager must be positive' })
  @Min(1000, { message: 'Minimum wager is 1000 CFC' })
  @Max(1000000, { message: 'Maximum wager is 1,000,000 CFC' })
  wager!: number;

  @IsString({ message: 'Payment signature must be a string' })
  @IsNotEmpty({ message: 'Payment signature is required for on-chain verification' })
  @Matches(/^0x[a-fA-F0-9]{64,130}$/, {
    message: 'Payment signature must be a valid Ethereum signature or transaction hash',
  })
  paymentSignature!: string;
}
