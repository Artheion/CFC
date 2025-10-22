import { IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID, Max, Min, Matches } from 'class-validator';

export class PlaceBetDto {
  @IsUUID(4, { message: 'Cock ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Cock ID is required' })
  cockId!: string;

  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be positive' })
  @Min(1000, { message: 'Minimum bet is 1000 CFC' })
  @Max(1000000, { message: 'Maximum bet is 1,000,000 CFC' })
  amount!: number;

  @IsString({ message: 'Payment signature must be a string' })
  @IsNotEmpty({ message: 'Payment signature is required for on-chain verification' })
  @Matches(/^0x[a-fA-F0-9]{130}$/, {
    message: 'Payment signature must be a valid Ethereum signature',
  })
  paymentSignature!: string;
}
