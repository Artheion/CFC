import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { getAddress, verifyMessage } from 'ethers';
import { PrismaService } from '@infra/prisma/prisma.service';

interface NonceEntry {
  nonce: string;
  issuedAt: number;
  message: string;
}

@Injectable()
export class AuthService {
  private readonly nonceStore = new Map<string, NonceEntry>();
  private static readonly NONCE_TTL_MS = 5 * 60 * 1000;
  private static readonly SIGN_MESSAGE_HEADER = 'CFC Authentication';
  private static readonly REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async requestNonce(walletAddress: string) {
    const normalizedWallet = this.normalizeWallet(walletAddress);

    this.cleanupExpiredNonces();
    const nonce = randomBytes(32).toString('hex');
    const issuedAt = Date.now();
    const message = this.buildSignMessage(normalizedWallet, nonce, issuedAt);

    this.nonceStore.set(normalizedWallet, { nonce, issuedAt, message });

    return {
      walletAddress: normalizedWallet,
      nonce,
      message,
      expiresAt: new Date(issuedAt + AuthService.NONCE_TTL_MS).toISOString(),
    };
  }

  async login(walletAddress: string, signature: string, ipAddress?: string, userAgent?: string) {
    const normalizedWallet = this.normalizeWallet(walletAddress);

    this.cleanupExpiredNonces();
    const nonceEntry = this.nonceStore.get(normalizedWallet);

    if (!nonceEntry) {
      // Log failed attempt
      console.warn('[AUTH] Login failed - no nonce found', {
        wallet: normalizedWallet,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Nonce not found. Request a new one.');
    }

    if (Date.now() - nonceEntry.issuedAt > AuthService.NONCE_TTL_MS) {
      this.nonceStore.delete(normalizedWallet);
      console.warn('[AUTH] Login failed - nonce expired', {
        wallet: normalizedWallet,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Nonce expired. Request a new one.');
    }

    const recoveredAddress = this.verifySignature(nonceEntry.message, signature);

    if (recoveredAddress !== normalizedWallet) {
      console.warn('[AUTH] Login failed - signature verification failed', {
        wallet: normalizedWallet,
        recoveredAddress,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Signature verification failed.');
    }

    this.nonceStore.delete(normalizedWallet);

    const user = await this.ensureUser(normalizedWallet);
    await this.cleanupExpiredRefreshTokens(user.id);
    const tokens = await this.generateTokens(user);

    // Log successful login
    console.log('[AUTH] Login successful', {
      userId: user.id,
      wallet: normalizedWallet,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    return {
      ...tokens,
      user,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const parts = refreshToken.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [tokenId, secret] = parts;
    const storedToken = await this.prisma.refreshToken.findUnique({ where: { id: tokenId } });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const isMatch = await bcrypt.compare(secret, storedToken.tokenHash);

    if (!isMatch) {
      await this.prisma.refreshToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token invalid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: storedToken.userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    await this.cleanupExpiredRefreshTokens(user.id);
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user,
    };
  }

  private async ensureUser(walletAddress: string) {
    const now = new Date();
    const adminWallet = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();
    const isAdmin = adminWallet && walletAddress.toLowerCase() === adminWallet;

    return this.prisma.user.upsert({
      where: { walletAddress },
      update: {
        lastLogin: now,
        ...(isAdmin && { isAdmin: true }), // Set admin if wallet matches
      },
      create: {
        walletAddress,
        lastLogin: now,
        isAdmin: isAdmin || false,
      },
    });
  }

  private async generateTokens(user: { id: string; walletAddress: string }) {
    const payload = { sub: user.id, walletAddress: user.walletAddress };
    const accessToken = await this.jwtService.signAsync(payload);

    const tokenId = randomUUID();
    const secret = randomBytes(48).toString('hex');
    const refreshToken = `${tokenId}.${secret}`;
    const tokenHash = await bcrypt.hash(secret, 12);
    const expiresAt = new Date(Date.now() + AuthService.REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private buildSignMessage(walletAddress: string, nonce: string, issuedAt: number) {
    const issuedAtIso = new Date(issuedAt).toISOString();
    return `${AuthService.SIGN_MESSAGE_HEADER}\nNonce: ${nonce}\nWallet: ${walletAddress}\nIssued At: ${issuedAtIso}`;
  }

  private async cleanupExpiredRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
  }

  private cleanupExpiredNonces() {
    const now = Date.now();
    for (const [wallet, entry] of this.nonceStore.entries()) {
      if (now - entry.issuedAt > AuthService.NONCE_TTL_MS) {
        this.nonceStore.delete(wallet);
      }
    }
  }

  private normalizeWallet(walletAddress: string) {
    const trimmed = walletAddress?.trim();
    if (!trimmed) {
      throw new UnauthorizedException('Wallet address is required.');
    }

    try {
      return getAddress(trimmed);
    } catch (error) {
      throw new UnauthorizedException('Invalid wallet address.');
    }
  }

  private verifySignature(message: string, signature: string) {
    const normalizedSignature = signature?.trim();
    if (!normalizedSignature) {
      throw new UnauthorizedException('Signature is required.');
    }

    const candidates = [normalizedSignature];

    if (!normalizedSignature.startsWith('0x')) {
      candidates.push(`0x${normalizedSignature}`);
    }

    for (const candidate of candidates) {
      try {
        const recovered = verifyMessage(message, candidate);
        return getAddress(recovered);
      } catch (error) {
        // try next candidate
      }
    }

    throw new UnauthorizedException('Signature verification failed.');
  }
}
