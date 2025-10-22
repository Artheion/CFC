import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');

    const transports: winston.transport[] = [];

    // Console transport for development
    if (env === 'development') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
              const ctx = context ? `[${context}]` : '';
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} ${level} ${ctx} ${message} ${metaStr}`;
            }),
          ),
        }),
      );
    }

    // File transport for production
    if (env === 'production' || env === 'staging') {
      // Error logs
      transports.push(
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: '30d',
          maxSize: '20m',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      );

      // Combined logs
      transports.push(
        new DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      );

      // Security audit logs
      transports.push(
        new DailyRotateFile({
          filename: 'logs/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'warn',
          maxFiles: '90d',
          maxSize: '20m',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      transports,
      exitOnError: false,
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string, meta?: Record<string, any>) {
    this.logger.info(message, { context: context || this.context, ...meta });
  }

  error(message: string, trace?: string, context?: string, meta?: Record<string, any>) {
    this.logger.error(message, {
      context: context || this.context,
      trace,
      ...meta,
    });
  }

  warn(message: string, context?: string, meta?: Record<string, any>) {
    this.logger.warn(message, { context: context || this.context, ...meta });
  }

  debug(message: string, context?: string, meta?: Record<string, any>) {
    this.logger.debug(message, { context: context || this.context, ...meta });
  }

  verbose(message: string, context?: string, meta?: Record<string, any>) {
    this.logger.verbose(message, { context: context || this.context, ...meta });
  }

  // Security-specific logging methods
  logSecurityEvent(event: string, details: Record<string, any>) {
    this.logger.warn(`[SECURITY] ${event}`, {
      context: 'Security',
      event,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  logAuthAttempt(success: boolean, details: Record<string, any>) {
    const event = success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE';
    this.logSecurityEvent(event, {
      success,
      ...details,
    });
  }

  logAdminAction(action: string, details: Record<string, any>) {
    this.logSecurityEvent('ADMIN_ACTION', {
      action,
      ...details,
    });
  }

  logSuspiciousActivity(activity: string, details: Record<string, any>) {
    this.logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      activity,
      ...details,
    });
  }
}
