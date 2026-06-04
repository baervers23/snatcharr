/**
 * Simple in-memory rate limiter (use Redis adapter in production via REDIS_URL env).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { windowMs, max, keyPrefix = "rl" } = options;
  const storeKey = `${keyPrefix}:${key}`;
  const now = Date.now();

  const entry = store.get(storeKey);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(storeKey, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

/** Convenience: 10 search requests per minute per IP */
export function searchRateLimit(ip: string): RateLimitResult {
  return rateLimit(ip, { windowMs: 60_000, max: 30, keyPrefix: "search" });
}

/** Login attempts: 5 per 15 min per IP */
export function loginRateLimit(ip: string): RateLimitResult {
  return rateLimit(ip, { windowMs: 15 * 60_000, max: 5, keyPrefix: "login" });
}
