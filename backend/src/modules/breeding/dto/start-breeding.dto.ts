import { IsUUID } from 'class-validator';

export class StartBreedingDto {
  @IsUUID()
  cockId!: string;

  @IsUUID()
  chickenId!: string;
}
