/**
 * Rate limiting utilities
 * Uses Vercel KV to track request rates per IP/user
 */

import { kv } from "@vercel/kv";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds until retry allowed
};

export type RateLimitConfig = {
  window: number; // Time window in seconds (e.g., 3600 for 1 hour)
  limit: number; // Max requests per window
  identifier?: string; // Optional custom identifier (overrides IP detection)
};

/**
 * Get client identifier from request headers
 * Can be called with Request object or headers directly
 */
function getClientIdentifier(
  customIdentifier?: string,
  requestHeaders?: Headers
): string {
  if (customIdentifier) {
    return customIdentifier;
  }

  if (!requestHeaders) {
    return "unknown";
  }

  // Get IP from headers (works on Vercel and most platforms)
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const realIp = requestHeaders.get("x-real-ip");
  
  // Extract first IP from forwarded-for (may contain multiple IPs)
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
  
  return ip;
}

/**
 * Check rate limit and increment counter
 * Returns whether the request should be allowed
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  requestHeaders?: Headers
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(config.identifier, requestHeaders);
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
  const windowStart = now - (now % config.window); // Align to window boundary
  const key = `ratelimit:${identifier}:${windowStart}`;

  try {
    // Get current count
    const current = await kv.get<number>(key);

    if (current === null) {
      // First request in this window - initialize counter
      await kv.set(key, 1, { ex: config.window });
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: windowStart + config.window,
      };
    }

    if (current >= config.limit) {
      // Rate limit exceeded
      const ttl = await kv.ttl(key);
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: windowStart + config.window,
        retryAfter: ttl > 0 ? ttl : config.window,
      };
    }

    // Increment counter
    const newCount = await kv.incr(key);
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - newCount,
      reset: windowStart + config.window,
    };
  } catch (error) {
    // If KV fails, allow the request (fail open)
    console.warn("Rate limit check failed, allowing request:", error);
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: now + config.window,
    };
  }
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Anonymous users: 10 requests per hour
  ANONYMOUS: {
    window: 60 * 60, // 1 hour
    limit: 10,
  },
  // Logged-in users: 50 requests per hour (can be increased per plan)
  AUTHENTICATED: {
    window: 60 * 60, // 1 hour
    limit: 50,
  },
  // Strict limit for decode endpoint: 5 requests per hour per IP
  DECODE_STRICT: {
    window: 60 * 60, // 1 hour
    limit: 5,
  },
} as const;

/**
 * Check rate limit for decode endpoint
 * Uses stricter limits to protect expensive operations
 */
export async function checkDecodeRateLimit(
  userId?: string,
  requestHeaders?: Headers
): Promise<RateLimitResult> {
  const config = userId
    ? RATE_LIMITS.AUTHENTICATED
    : RATE_LIMITS.DECODE_STRICT;

  return checkRateLimit(
    {
      ...config,
      identifier: userId, // Use userId if provided, otherwise IP-based
    },
    requestHeaders
  );
}

