import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsPositive, IsString, Max, Min, Matches } from 'class-validator';

export class BuyItemDto {
  @IsString({ message: 'Item slug must be a string' })
  @IsNotEmpty({ message: 'Item slug is required' })
  @Matches(/^[a-z0-9\-]+$/, { message: 'Item slug must contain only lowercase letters, numbers, and hyphens' })
  itemSlug!: string;

  @Type(() => Number)
  @IsInt({ message: 'Quantity must be an integer' })
  @IsPositive({ message: 'Quantity must be positive' })
  @Min(1, { message: 'Minimum quantity is 1' })
  @Max(50, { message: 'Maximum quantity is 50' })
  quantity = 1;

  @IsString({ message: 'Payment signature must be a string' })
  @IsNotEmpty({ message: 'Payment signature is required for on-chain verification' })
  @Matches(/^0x[a-fA-F0-9]{130}$/, {
    message: 'Payment signature must be a valid Ethereum signature',
  })
  paymentSignature!: string; // Payment signature is REQUIRED for CFC purchases
}
