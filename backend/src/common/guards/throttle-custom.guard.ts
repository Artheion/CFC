import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { LoggerService } from '@infra/logger/logger.service';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(private readonly loggerService: LoggerService) {
    super();
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
    // Track by IP and user ID if authenticated
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.userId;
    
    return userId ? `${userId}:${ip}` : ip;
  }
}
