import { Module, Global } from '@nestjs/common';
import { EscrowService } from './escrow.service';

@Global()
@Module({
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
