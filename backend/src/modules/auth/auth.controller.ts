import { Body, Controller, Post, Res, Req, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RequestNonceDto } from './dto/request-nonce.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('nonce')
  async requestNonce(@Body() body: RequestNonceDto) {
    return this.authService.requestNonce(body.walletAddress);
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const authResult = await this.authService.login(
      body.walletAddress,
      body.signature,
      req.ip,
      req.headers['user-agent'],
    );

    // Set HttpOnly cookies for secure token storage
    this.setAuthCookies(res, authResult.accessToken, authResult.refreshToken);

    // Return user data only (NO tokens in response body)
    return {
      user: authResult.user,
      message: 'Login successful',
    };
  }

  /**
   * Refresh access token using HttpOnly cookie
   * Frontend calls this on app load to restore session
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract refresh token from HttpOnly cookie
    const refreshTokenId = req.cookies?.['refreshTokenId'];
    const refreshTokenSecret = req.cookies?.['refreshTokenSecret'];

    if (!refreshTokenId || !refreshTokenSecret) {
      // Clear any existing cookies
      this.clearAuthCookies(res);
      return {
        authenticated: false,
        message: 'No refresh token found',
      };
    }

    try {
      const authResult = await this.authService.refreshFromCookie(
        refreshTokenId,
        refreshTokenSecret,
      );

      // Set new tokens in HttpOnly cookies
      this.setAuthCookies(res, authResult.accessToken, authResult.refreshToken);

      return {
        authenticated: true,
        user: authResult.user,
        message: 'Token refreshed successfully',
      };
    } catch (error) {
      // Clear invalid cookies
      this.clearAuthCookies(res);
      return {
        authenticated: false,
        message: 'Invalid or expired refresh token',
      };
    }
  }

  /**
   * Check if user has valid session (for frontend to verify auth state)
   */
  @Public()
  @Get('check')
  async checkAuth(@Req() req: Request) {
    const refreshTokenId = req.cookies?.['refreshTokenId'];
    const refreshTokenSecret = req.cookies?.['refreshTokenSecret'];

    return {
      authenticated: Boolean(refreshTokenId && refreshTokenSecret),
    };
  }

  /**
   * Logout - revoke refresh token and clear cookies
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshTokenId = req.cookies?.['refreshTokenId'];

    if (refreshTokenId) {
      await this.authService.revokeRefreshToken(refreshTokenId);
    }

    this.clearAuthCookies(res);

    return {
      message: 'Logged out successfully',
    };
  }

  /**
   * Set authentication cookies (HttpOnly, Secure, SameSite)
   */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const [refreshTokenId, refreshTokenSecret] = refreshToken.split('.');

    const cookieOptions = {
      httpOnly: true, // Cannot be accessed by JavaScript
      secure: isProduction, // HTTPS only in production
      sameSite: 'lax' as const, // CSRF protection (lax for cross-site navigation)
      path: '/',
    };

    // Access token - short-lived (15 minutes)
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Refresh token ID - long-lived (30 days)
    res.cookie('refreshTokenId', refreshTokenId, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Refresh token secret - long-lived (30 days)
    res.cookie('refreshTokenSecret', refreshTokenSecret, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    console.log('[AUTH] ✅ Set HttpOnly cookies for secure token storage');
  }

  /**
   * Clear all authentication cookies
   */
  private clearAuthCookies(res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshTokenId', cookieOptions);
    res.clearCookie('refreshTokenSecret', cookieOptions);

    console.log('[AUTH] ✅ Cleared authentication cookies');
  }
}
