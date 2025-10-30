/**
 * Storage layer for slug mappings
 * Uses Next.js cache to store slug → report data mappings
 * 
 * Approach:
 * - Store full report data keyed by slug using Next.js cache
 * - Pages are cached via ISR (revalidate)
 * - Reports persist in cache for 7 days
 */
import { getOrSet, cacheKey, CACHE_TTL } from "./cache";
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";

export type SlugMapping = {
  slug: string;
  addrHash: string;
  prefsHash: string;
};

/**
 * Store full report data by slug
 * This is called during workflow execution after report is generated
 */
export async function storeSlugMapping(
  slug: string,
  addrHash: string,
  prefsHash: string,
  listing: ListingJSON,
  report: DecoderReport
): Promise<void> {
  // Store the full data using our cache system
  // The cache key includes the slug, so it's retrievable by slug
  await getOrSet(
    cacheKey("slug:full", slug, "v1"),
    CACHE_TTL.REPORT,
    async () => ({ listing, report })
  );
}

/**
 * Get full report data by slug
 * Returns null if not found
 */
export async function getSlugMapping(
  slug: string
): Promise<{ listing: ListingJSON; report: DecoderReport } | null> {
  // Try to get from cache
  // If not found, the fetcher returns null
  const data = await getOrSet(
    cacheKey("slug:full", slug, "v1"),
    CACHE_TTL.REPORT,
    async () => null
  );
  
  return data === null ? null : data;
}

/**
 * Check if slug exists
 */
export async function slugExists(slug: string): Promise<boolean> {
  const data = await getSlugMapping(slug);
  return data !== null;
}

