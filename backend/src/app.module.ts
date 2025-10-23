import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import configuration from './config/configuration';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.module';
import { BlockchainModule } from './infra/blockchain/blockchain.module';
import { EscrowModule } from './infra/escrow/escrow.module';
import { LoggerModule } from './infra/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { FightsModule } from './modules/fights/fights.module';
import { EconomyModule } from './modules/economy/economy.module';
import { AdminModule } from './modules/admin/admin.module';
import { ShopModule } from './modules/shop/shop.module';
import { CocksModule } from './modules/cocks/cocks.module';
import { ChickensModule } from './modules/chickens/chickens.module';
import { EggsModule } from './modules/eggs/eggs.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BetsModule } from './modules/bets/bets.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CustomThrottlerGuard } from './common/guards/throttle-custom.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { HealthModule } from './modules/health/health.module';
import { BreedingModule } from './modules/breeding/breeding.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test', 'staging').default('development'),
        PORT: Joi.number().default(4000),
        DATABASE_URL: Joi.string().uri().required(),
        REDIS_URL: Joi.string().uri().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        CORS_ORIGIN: Joi.string().required(),
        CSRF_SECRET: Joi.string().min(32),
        LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
        HOUSE_WALLET_PRIVATE_KEY: Joi.string().allow('', null),
        TREASURY_PRIVATE_KEY: Joi.string().allow('', null),
        TREASURY_ADDRESS: Joi.string().allow('', null),
        BNB_RPC_ENDPOINT: Joi.string().uri().required(),
        ESCROW_CONTRACT_ADDRESS: Joi.string().allow('', null),
        CFC_TOKEN_ADDRESS: Joi.string().allow('', null),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 10000, // 10 seconds
        limit: 50, // 50 requests per 10 seconds (for burst protection)
      },
      {
        name: 'default',
        ttl: 60000, // 1 minute in milliseconds
        limit: 200, // 200 requests per minute (allows ~15 refreshes)
      },
      {
        name: 'auth',
        ttl: 900000, // 15 minutes in milliseconds
        limit: 5, // 5 login attempts per 15 minutes
      },
      {
        name: 'expensive',
        ttl: 60000, // 1 minute
        limit: 10, // 10 expensive operations per minute (fights, spins, etc.)
      },
    ]),
    LoggerModule,
    PrismaModule,
    QueueModule,
    BlockchainModule,
    EscrowModule,
    AuthModule,
    UsersModule,
    ReferralsModule,
    FightsModule,
    EconomyModule,
    AdminModule,
    ShopModule,
    CocksModule,
    ChickensModule,
    EggsModule,
    InventoryModule,
    BetsModule,
    HealthModule,
    BreedingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
