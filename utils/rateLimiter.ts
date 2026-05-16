/**
 * Client-side rate limiter — OWASP brute-force protection.
 * Tracks attempt counts per key in memory (resets on app restart).
 * Firebase Auth also enforces server-side limits independently.
 */

interface Bucket {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

interface RateLimitConfig {
  /** Max attempts within windowMs before locking */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Lock duration in milliseconds after maxAttempts exceeded */
  lockMs: number;
}

const PRESETS: Record<string, RateLimitConfig> = {
  login:         { maxAttempts: 5,  windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  passwordReset: { maxAttempts: 3,  windowMs: 60 * 60_000, lockMs: 60 * 60_000 },
  register:      { maxAttempts: 3,  windowMs: 60 * 60_000, lockMs: 60 * 60_000 },
  search:        { maxAttempts: 30, windowMs: 60_000,       lockMs: 30_000      },
};

export type RateLimitKey = keyof typeof PRESETS;

/**
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }.
 * Call before the actual operation; call recordSuccess / recordFailure after.
 */
export function checkRateLimit(
  action: RateLimitKey,
  identifier: string
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const config = PRESETS[action];
  const key    = `${action}:${identifier}`;
  const now    = Date.now();

  let bucket = buckets.get(key);

  if (bucket) {
    // Still locked?
    if (bucket.lockedUntil > now) {
      return { allowed: false, retryAfterMs: bucket.lockedUntil - now };
    }
    // Window expired — reset
    if (now - bucket.windowStart > config.windowMs) {
      bucket = { count: 0, windowStart: now, lockedUntil: 0 };
      buckets.set(key, bucket);
    }
  } else {
    bucket = { count: 0, windowStart: now, lockedUntil: 0 };
    buckets.set(key, bucket);
  }

  return { allowed: true };
}

/** Call after a failed attempt to increment counter and possibly lock */
export function recordFailure(action: RateLimitKey, identifier: string): void {
  const config = PRESETS[action];
  const key    = `${action}:${identifier}`;
  const now    = Date.now();

  const bucket = buckets.get(key) ?? { count: 0, windowStart: now, lockedUntil: 0 };
  bucket.count += 1;

  if (bucket.count >= config.maxAttempts) {
    bucket.lockedUntil = now + config.lockMs;
  }

  buckets.set(key, bucket);
}

/** Call after a successful attempt to reset the bucket */
export function recordSuccess(action: RateLimitKey, identifier: string): void {
  buckets.delete(`${action}:${identifier}`);
}

/** Human-readable remaining lock time */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 2) return 'دقيقة واحدة';
  return `${minutes} دقائق`;
}
