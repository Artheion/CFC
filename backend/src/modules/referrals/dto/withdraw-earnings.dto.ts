import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class WithdrawEarningsDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.001, { message: 'Minimum withdrawal is 0.001 BNB' })
  amount!: number;
}
