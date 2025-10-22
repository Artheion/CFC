import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection: ReturnType<typeof doubleCsrf>;

  constructor() {
    const csrfSecret = process.env.CSRF_SECRET || this.generateSecret();
    
    if (!process.env.CSRF_SECRET) {
      console.warn('⚠️  CSRF_SECRET not set in environment variables. Using generated secret.');
      console.warn('   For production, set CSRF_SECRET in your environment.');
    }

    this.csrfProtection = doubleCsrf({
      getSecret: () => csrfSecret,
      cookieName: '__Host-cfc.x-csrf-token',
      cookieOptions: {
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3600000, // 1 hour
      },
      size: 64,
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
      getTokenFromRequest: (req) => {
        // Check header first, then body
        return req.headers['x-csrf-token'] as string || req.body?._csrf;
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    const { doubleCsrfProtection } = this.csrfProtection;

    // Apply CSRF protection
    doubleCsrfProtection(req, res, (error?: any) => {
      if (error) {
        throw new ForbiddenException('Invalid CSRF token');
      }
      next();
    });
  }

  private generateSecret(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate CSRF token for a request
   */
  static generateToken(req: Request): string {
    return (req as any).csrfToken?.() || '';
  }
}

/**
 * Endpoint to get CSRF token
 */
export function getCsrfToken(req: Request): { csrfToken: string } {
  const token = CsrfMiddleware.generateToken(req);
  return { csrfToken: token };
}
