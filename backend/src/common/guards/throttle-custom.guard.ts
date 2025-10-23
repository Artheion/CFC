import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { LoggerService } from '@infra/logger/logger.service';
import { SKIP_THROTTLE_KEY } from '@common/decorators/skip-throttle.decorator';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly loggerService: LoggerService,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if endpoint has SkipThrottle decorator
    const skipThrottle = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipThrottle) {
      return true;
    }

    // Check if it's a GET request (read-only operations)
    const request = context.switchToHttp().getRequest();
    const isGetRequest = request.method === 'GET';
    
    // Skip throttling for all GET requests to ensure seamless navigation
    if (isGetRequest) {
      return true;
    }

    // Apply throttling to POST, PUT, PATCH, DELETE
    return super.canActivate(context);
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    
    // Log rate limit violation
    this.loggerService.logSuspiciousActivity('RATE_LIMIT_EXCEEDED', {
      ip: request.ip,
      url: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      userId: request.user?.userId,
    });

    throw new ThrottlerException('Too many requests. Please try again later.');
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by user ID primarily for authenticated users
    const userId = req.user?.userId;
    
    // For authenticated users, track by userId only (not IP)
    // This prevents issues with users behind NAT or corporate proxies
    if (userId) {
      return `user:${userId}`;
    }
    
    // For unauthenticated users, track by IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
