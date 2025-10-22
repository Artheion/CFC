import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '@infra/prisma/prisma.service';

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate MFA secret for a user
   */
  async generateMfaSecret(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `CFC (${user.username || user.walletAddress.slice(0, 8)})`,
      issuer: 'Cocks Fight Club',
      length: 32,
    });

    // Generate QR code for easy scanning
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Store secret in database (encrypted in production)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // You'll need to add these fields to your schema
        mfaSecret: secret.base32,
        mfaEnabled: false, // Not enabled until verified
      } as any,
    });

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  /**
   * Enable MFA for a user after verifying the token
   */
  async enableMfa(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).mfaSecret) {
      throw new UnauthorizedException('MFA not initialized');
    }

    const verified = speakeasy.totp.verify({
      secret: (user as any).mfaSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock skew
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true } as any,
    });

    return true;
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: string, token: string): Promise<boolean> {
    const verified = await this.verifyMfaToken(userId, token);

    if (!verified) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      } as any,
    });

    return true;
  }

  /**
   * Verify MFA token
   */
  async verifyMfaToken(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).mfaEnabled || !(user as any).mfaSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: (user as any).mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    return (user as any)?.mfaEnabled || false;
  }

  /**
   * Generate backup codes for MFA
   */
  async generateBackupCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    const crypto = require('crypto');

    // Generate 10 backup codes
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    // Hash and store backup codes
    const hashedCodes = codes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex'),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: hashedCodes,
      } as any,
    });

    return codes;
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).mfaBackupCodes) {
      return false;
    }

    const crypto = require('crypto');
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');

    const backupCodes = (user as any).mfaBackupCodes as string[];
    const index = backupCodes.indexOf(hashedCode);

    if (index === -1) {
      return false;
    }

    // Remove used backup code
    backupCodes.splice(index, 1);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: backupCodes,
      } as any,
    });

    return true;
  }
}
