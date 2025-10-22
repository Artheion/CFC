import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '@infra/logger/logger.service';
import { PrismaService } from '@infra/prisma/prisma.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { action, resourceType } = metadata;

    const auditData = {
      action,
      resourceType,
      userId: user?.userId,
      walletAddress: user?.walletAddress,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    };

    // Log immediately
    this.logger.logAdminAction(action, auditData);

    return next.handle().pipe(
      tap({
        next: async (response) => {
          // Save to database for persistent audit trail
          try {
            await this.prisma.adminAuditLog.create({
              data: {
                adminId: user?.userId || 'unknown',
                action,
                details: {
                  ...auditData,
                  resourceType,
                  responseStatus: 'success',
                  responseData: this.sanitizeResponse(response),
                },
              },
            });
          } catch (error) {
            this.logger.error('Failed to create audit log', error.stack, 'AuditLogInterceptor');
          }
        },
        error: async (error) => {
          // Log errors too
          try {
            await this.prisma.adminAuditLog.create({
              data: {
                adminId: user?.userId || 'unknown',
                action,
                details: {
                  ...auditData,
                  resourceType,
                  responseStatus: 'error',
                  errorMessage: error.message,
                },
              },
            });
          } catch (logError) {
            this.logger.error('Failed to create error audit log', logError.stack, 'AuditLogInterceptor');
          }
        },
      }),
    );
  }

  private sanitizeResponse(response: any): any {
    if (!response) return null;
    
    // Don't log large responses
    const stringified = JSON.stringify(response);
    if (stringified.length > 1000) {
      return { _truncated: true, length: stringified.length };
    }
    
    return response;
  }
}
