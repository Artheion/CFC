import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SpinWheelDto {
  @IsString()
  @IsOptional()
  paymentSignature?: string;

  @IsString()
  @IsNotEmpty()
  wheelType!: string;
}
