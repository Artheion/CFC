import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FightsController } from './fights.controller';
import { FightsService } from './fights.service';
import { FightsGateway } from './fights.gateway';
import { FightEngineProcessor } from '@jobs/fight-engine.processor';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'dev-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [FightsController],
  providers: [FightsService, FightEngineProcessor, FightsGateway],
  exports: [FightsService, FightsGateway],
})
export class FightsModule implements OnModuleInit {
  constructor(
    private readonly fightEngineProcessor: FightEngineProcessor,
    private readonly fightsGateway: FightsGateway,
  ) {}

  /**
   * ✅ Inject WebSocket gateway into fight processor after initialization
   * This avoids circular dependency issues
   */
  onModuleInit() {
    this.fightEngineProcessor.setGateway(this.fightsGateway);
  }
}
