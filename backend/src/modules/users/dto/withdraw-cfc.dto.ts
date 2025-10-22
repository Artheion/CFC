import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class WithdrawCfcDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(100, { message: 'Minimum withdrawal is 100 $CFC' })
  amount!: number;
}
