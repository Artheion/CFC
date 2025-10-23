import { SetMetadata } from '@nestjs/common';

export const SKIP_THROTTLE_KEY = 'skipThrottle';

/**
 * Decorator to skip throttling for specific endpoints
 * Use this on GET endpoints that need to be called frequently without rate limiting
 */
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);
