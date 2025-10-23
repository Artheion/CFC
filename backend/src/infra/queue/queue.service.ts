import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: IORedis;
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL must be configured');
    }
    
    // Hide password in logs
    const sanitizedUrl = redisUrl.replace(/:[^:@]*@/, ':****@');
    this.logger.log(`[QueueService] Connecting to Redis: ${sanitizedUrl}`);
    
    // Add TLS support for rediss:// URLs (Redis Cloud, Redis.io)
    const connectionOptions: any = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
    };
    
    // If URL uses SSL (rediss://), enable TLS
    if (redisUrl.startsWith('rediss://')) {
      connectionOptions.tls = {
        rejectUnauthorized: false, // Required for some cloud Redis providers
      };
      this.logger.log('[QueueService] TLS/SSL enabled for Redis connection');
    } else {
      this.logger.log('[QueueService] Using non-SSL Redis connection');
    }
    
    this.connection = new IORedis(redisUrl, connectionOptions);
    
    // Add connection event handlers for debugging
    this.connection.on('connect', () => {
      this.logger.log('[QueueService] ✅ Redis connected successfully');
    });
    
    this.connection.on('ready', () => {
      this.logger.log('[QueueService] ✅ Redis ready to accept commands');
    });
    
    this.connection.on('error', (err) => {
      this.logger.error(`[QueueService] ❌ Redis connection error: ${err.message}`);
    });
    
    this.connection.on('close', () => {
      this.logger.warn('[QueueService] ⚠️  Redis connection closed');
    });
    
    this.connection.on('reconnecting', () => {
      this.logger.warn('[QueueService] 🔄 Redis reconnecting...');
    });
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
    return this.queues.get(name)!;
  }

  getConnection(): IORedis {
    return this.connection;
  }

  async onModuleDestroy() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    await this.connection.quit();
  }
}
