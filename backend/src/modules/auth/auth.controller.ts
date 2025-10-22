import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestNonceDto } from './dto/request-nonce.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('nonce')
  async requestNonce(@Body() body: RequestNonceDto) {
    return this.authService.requestNonce(body.walletAddress);
  }

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.walletAddress, body.signature);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }
}
