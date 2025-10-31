/**
 * Storage layer for slug mappings
 * Uses Vercel KV for persistent storage across requests
 * 
 * Approach:
 * - Store full report data keyed by slug using Vercel KV
 * - Pages are cached via ISR (revalidate)
 * - Reports persist in KV for 7 days
 */
import { kv } from "@vercel/kv";
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";
import type { AugmentJSON } from "@/types/augment";

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
  report: DecoderReport,
  augment?: AugmentJSON
): Promise<void> {
  const key = `slug:full:${slug}:v1`;
  const data = { listing, report, augment };
  
  // Store in KV with 7 day TTL (in seconds)
  // KV accepts objects directly and handles serialization
  await kv.set(key, data, { ex: 7 * 24 * 60 * 60 });
}

/**
 * Get full report data by slug
 * Returns null if not found
 */
export async function getSlugMapping(
  slug: string
): Promise<{ listing: ListingJSON; report: DecoderReport; augment?: AugmentJSON } | null> {
  const key = `slug:full:${slug}:v1`;
  
  try {
    // KV handles JSON serialization automatically
    const data = await kv.get<{ listing: ListingJSON; report: DecoderReport; augment?: AugmentJSON }>(key);
    return data || null;
  } catch (error) {
    console.error("Error fetching slug mapping from KV:", error);
    return null;
  }
}

/**
 * Check if slug exists
 */
export async function slugExists(slug: string): Promise<boolean> {
  const data = await getSlugMapping(slug);
  return data !== null;
}

