/**
 * Storage layer for report ID mappings
 * Uses Vercel KV for persistent storage across requests
 * 
 * Approach:
 * - Generate unique IDs for each report (not guessable)
 * - Store full report data keyed by ID using Vercel KV
 * - Pages are cached via ISR (revalidate)
 * - Reports persist in KV for 7 days
 */
import { kv } from "@vercel/kv";
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";
import type { AugmentJSON } from "@/types/augment";
import { randomBytes } from "crypto";

/**
 * Generate a unique, non-guessable ID for a report
 * Uses URL-safe base64 encoding of random bytes
 */
export function generateReportId(): string {
  // Generate 12 random bytes (96 bits of entropy)
  // This gives us ~16 characters of URL-safe base64
  const bytes = randomBytes(12);
  // Convert to URL-safe base64 (replaces + with -, / with _)
  return bytes.toString("base64url");
}

export type ReportMapping = {
  id: string;
  addrHash: string;
  prefsHash: string;
};

/**
 * Store full report data by ID
 * This is called during workflow execution after report is generated
 */
export async function storeReportMapping(
  id: string,
  addrHash: string,
  prefsHash: string,
  listing: ListingJSON,
  report: DecoderReport,
  augment?: AugmentJSON
): Promise<void> {
  const key = `report:${id}:v1`;
  const data = { listing, report, augment };
  
  // Store in KV with 7 day TTL (in seconds)
  // KV accepts objects directly and handles serialization
  await kv.set(key, data, { ex: 7 * 24 * 60 * 60 });
}

/**
 * Get full report data by ID
 * Returns null if not found
 */
export async function getReportMapping(
  id: string
): Promise<{ listing: ListingJSON; report: DecoderReport; augment?: AugmentJSON } | null> {
  const key = `report:${id}:v1`;
  
  try {
    // KV handles JSON serialization automatically
    const data = await kv.get<{ listing: ListingJSON; report: DecoderReport; augment?: AugmentJSON }>(key);
    return data || null;
  } catch (error) {
    console.error("Error fetching report mapping from KV:", error);
    return null;
  }
}

/**
 * Check if report ID exists
 */
export async function reportIdExists(id: string): Promise<boolean> {
  const data = await getReportMapping(id);
  return data !== null;
}

// Legacy functions for backward compatibility (if needed during migration)
export type SlugMapping = ReportMapping & { slug: string };

/**
 * @deprecated Use storeReportMapping instead
 */
export async function storeSlugMapping(
  slug: string,
  addrHash: string,
  prefsHash: string,
  listing: ListingJSON,
  report: DecoderReport,
  augment?: AugmentJSON
): Promise<void> {
  // For backward compatibility, treat slug as ID
  await storeReportMapping(slug, addrHash, prefsHash, listing, report, augment);
}

/**
 * @deprecated Use getReportMapping instead
 */
export async function getSlugMapping(
  slug: string
): Promise<{ listing: ListingJSON; report: DecoderReport; augment?: AugmentJSON } | null> {
  // For backward compatibility, treat slug as ID
  return getReportMapping(slug);
}

/**
 * @deprecated Use reportIdExists instead
 */
export async function slugExists(slug: string): Promise<boolean> {
  return reportIdExists(slug);
}

