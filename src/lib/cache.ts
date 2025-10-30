/**
 * Cache utilities using Vercel Data Cache
 * Provides idempotent read-through caching
 */
import { unstable_cache } from "next/cache";

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
 * Get or set a cached value
 * Uses Next.js unstable_cache for server-side caching
 * 
 * Note: unstable_cache only works in Server Components and Route Handlers
 * For edge runtime or client-side, consider using @vercel/kv
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
  // Use Next.js unstable_cache for server-side caching
  // This caches at the request level during build/render
  const cached = unstable_cache(
    fetcher,
    [key],
    {
      revalidate: ttl,
      tags: [`cache:${key}`],
    }
  );

  return cached();
}

/**
 * Invalidate cache by tag
 * Note: This requires revalidateTag from next/cache
 */
export async function invalidateCache(tag: string): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  revalidateTag(tag);
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

