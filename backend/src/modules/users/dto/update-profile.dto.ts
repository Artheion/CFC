import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeUsername, sanitizeUrl } from '@common/utils/sanitize.util';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9_\-\s]+$/, {
    message: 'Username can only contain letters, numbers, underscores, hyphens, and spaces',
  })
  @Transform(({ value }) => sanitizeUsername(value))
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048, { message: 'Avatar URL must not exceed 2048 characters' })
  @Matches(/^https?:\/\/.+/, { message: 'Avatar URL must be a valid HTTP/HTTPS URL' })
  @Transform(({ value }) => sanitizeUrl(value))
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  hasCompletedOnboarding?: boolean;
}
