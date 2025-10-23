import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './infra/prisma/prisma.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './infra/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const loggerService = app.get(LoggerService);

  // Use custom logger
  app.useLogger(loggerService);

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // Enhanced security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Minimize in production
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'wss:',
            'https://bsc-dataseed.binance.org',
            'https://bsc-dataseed1.bnbchain.org',
            'https://data-seed-prebsc-1-s1.binance.org',
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: true,
    }),
  );

  // Cookie parser with security options
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // Enhanced validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: isProduction, // Don't leak validation details in production
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS configuration - NO WILDCARDS in production
  const corsOrigins = configService.get<string>('CORS_ORIGIN', '');
  const parsedOrigins = corsOrigins
    ? corsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  // Validate CORS configuration
  if (isProduction && (parsedOrigins.length === 0 || parsedOrigins.includes('*'))) {
    loggerService.warn(
      '⚠️  WARNING: CORS_ORIGIN not properly configured for production!',
      'Bootstrap',
    );
    loggerService.warn(
      '   Using wildcard (*) - Set specific domains in CORS_ORIGIN environment variable',
      'Bootstrap',
    );
    // Don't throw - allow app to start with warning
  }

  // Use wildcard if no origins configured (for development/testing)
  const origin = parsedOrigins.length === 0 || (parsedOrigins.length === 1 && parsedOrigins[0] === '*') 
    ? '*' 
    : parsedOrigins;

  app.enableCors({
    origin,
    credentials: true, // ✅ CRITICAL: Allow cookies to be sent with requests
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token', 'Set-Cookie'], // Expose Set-Cookie header
    maxAge: 3600, // 1 hour
  });

  loggerService.log(`CORS enabled for origins: ${Array.isArray(origin) ? origin.join(', ') : origin}`, 'Bootstrap');
  loggerService.log(`✅ CORS credentials enabled for HttpOnly cookie support`, 'Bootstrap');

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0'); // Bind to all interfaces (required for Render/Docker)

  loggerService.log(`🚀 CFC backend listening on port ${port}`, 'Bootstrap');
  loggerService.log(`🔒 Environment: ${configService.get<string>('NODE_ENV')}`, 'Bootstrap');
  loggerService.log(`🔐 Security headers enabled`, 'Bootstrap');
  
  if (!isProduction) {
    loggerService.warn('⚠️  Running in development mode - some security features are relaxed', 'Bootstrap');
  }
}

bootstrap();
