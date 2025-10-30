/**
 * Cache utilities using Vercel KV for persistent storage
 * Provides idempotent read-through caching across requests
 * 
 * Strategy:
 * - Use Vercel KV for expensive operations (RentCast API, AI reports, augmentations)
 * - Prevents duplicate API calls and saves costs
 * - Cache keys are content-addressed for idempotency
 */
import { kv } from "@vercel/kv";

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  PROPERTY: 7 * 24 * 60 * 60, // 7 days
  RENTCAST: 7 * 24 * 60 * 60, // 7 days
  SCRAPE: 6 * 60 * 60, // 6 hours
  AUGMENT: 7 * 24 * 60 * 60, // 7 days
  REPORT: 7 * 24 * 60 * 60, // 7 days
  OG_IMAGE: 7 * 24 * 60 * 60, // 7 days
} as const;

/**
 * Get or set a cached value using Vercel KV
 * Uses KV for persistent storage across requests
 * 
 * @param key - Cache key (should include version suffix like :v1)
 * @param ttl - Time to live in seconds
 * @param fetcher - Function to fetch value if not cached
 * @returns Cached or newly fetched value
 */
export async function getOrSet<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    // Try to get from KV first
    // KV handles JSON serialization automatically
    const cached = await kv.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Not in cache, fetch new value
    const value = await fetcher();
    
    // Store in KV with TTL
    // KV accepts objects directly and handles serialization
    await kv.set(key, value, { ex: ttl });
    
    return value;
  } catch (error) {
    // If KV is not configured or fails, fall back to fetching
    // This allows graceful degradation
    console.warn(`KV cache error for key ${key}, falling back to direct fetch:`, error);
    return await fetcher();
  }
}

/**
 * Get a cached value without setting
 * Returns null if not found
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    // KV handles JSON serialization automatically
    const cached = await kv.get<T>(key);
    return cached;
  } catch (error) {
    console.warn(`KV get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set a cached value
 */
export async function set<T>(
  key: string,
  value: T,
  options: { ttl: number }
): Promise<void> {
  try {
    // KV accepts objects directly and handles serialization
    await kv.set(key, value, { ex: options.ttl });
  } catch (error) {
    console.warn(`KV set error for key ${key}:`, error);
  }
}

/**
 * Invalidate cache by key
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await kv.del(key);
  } catch (error) {
    console.warn(`KV delete error for key ${key}:`, error);
  }
}

/**
 * Generate cache key with version
 */
export function cacheKey(
  prefix: string,
  identifier: string,
  version: string = "v1"
): string {
  return `${prefix}:${identifier}:${version}`;
}

// Cache key prefixes
export const CACHE_PREFIXES = {
  PROPERTY: "property:addr",
  RENTCAST: "rentcast:addr",
  SCRAPE: "scrape:url",
  AUGMENT: "augment:addr",
  REPORT: "report",
  OG_IMAGE: "og",
} as const;

