import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 * Removes all HTML tags and dangerous characters
 */
export function sanitizeInput(input: string | undefined | null): string {
  if (!input) return '';

  // Remove all HTML tags and scripts
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // Trim whitespace
  return cleaned.trim();
}

/**
 * Sanitize username - alphanumeric, underscores, hyphens only
 */
export function sanitizeUsername(username: string | undefined | null): string {
  if (!username) return '';

  const sanitized = sanitizeInput(username);
  
  // Only allow alphanumeric, underscores, hyphens, and spaces
  return sanitized.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
}

/**
 * Sanitize description - allow basic formatting but strip dangerous content
 */
export function sanitizeDescription(description: string | undefined | null): string {
  if (!description) return '';

  // Allow some basic HTML for descriptions but sanitize
  const cleaned = DOMPurify.sanitize(description, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  return cleaned.trim();
}

/**
 * Sanitize referral code - uppercase alphanumeric and hyphens only
 */
export function sanitizeReferralCode(code: string | undefined | null): string {
  if (!code) return '';

  const sanitized = sanitizeInput(code).toUpperCase();
  
  // Only allow uppercase alphanumeric and hyphens
  return sanitized.replace(/[^A-Z0-9\-]/g, '');
}

/**
 * Sanitize avatar URL - basic URL validation
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';

  const sanitized = sanitizeInput(url);

  try {
    const parsed = new URL(sanitized);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Escape special characters for logging to prevent log injection
 */
export function sanitizeForLog(input: string | undefined | null): string {
  if (!input) return '';

  return input
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}
