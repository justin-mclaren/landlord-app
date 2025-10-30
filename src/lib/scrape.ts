/**
 * Scraping fallback module
 * Parses HTML/DOM data from browser extension or server-side scraping
 * Used when RentCast API is missing core fields
 */

import type { ListingJSON } from "@/types/listing";
import { urlHash } from "@/lib/hash";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "@/lib/cache";

/**
 * Scraped data structure from browser extension
 * Browser extension sends DOM elements as JSON
 */
export type ScrapedData = {
  url: string;
  html?: string; // Raw HTML (optional - for server-side parsing)
  dom?: Record<string, unknown>; // DOM JSON from browser extension
  metadata?: {
    title?: string;
    description?: string;
    address?: string;
    price?: string;
    beds?: string;
    baths?: string;
    sqft?: string;
    features?: string[];
    [key: string]: unknown;
  };
};

/**
 * Extract property data from scraped HTML/DOM
 * Parses common patterns from Zillow, Apartments.com, etc.
 */
function parseScrapedData(scraped: ScrapedData): Partial<ListingJSON["listing"]> {
  const result: Partial<ListingJSON["listing"]> = {};

  // Try to extract from metadata first (if browser extension provides it)
  if (scraped.metadata) {
    const meta = scraped.metadata;

    // Address
    if (meta.address) {
      result.address = meta.address;
    }

    // Price - parse from string like "$2,500/month" or "$2,500"
    if (meta.price) {
      const priceMatch = meta.price.match(/\$?([\d,]+)/);
      if (priceMatch) {
        result.price = parseInt(priceMatch[1].replace(/,/g, ""), 10);
        result.price_currency = "USD";
        // Determine if rent or buy based on keywords
        const priceLower = meta.price.toLowerCase();
        if (priceLower.includes("rent") || priceLower.includes("/month") || priceLower.includes("/mo")) {
          result.price_type = "rent";
        } else if (priceLower.includes("buy") || priceLower.includes("sale")) {
          result.price_type = "buy";
        }
      }
    }

    // Beds
    if (meta.beds) {
      const bedsMatch = String(meta.beds).match(/(\d+)/);
      if (bedsMatch) {
        result.beds = parseInt(bedsMatch[1], 10);
      }
    }

    // Baths
    if (meta.baths) {
      const bathsMatch = String(meta.baths).match(/(\d+(?:\.\d+)?)/);
      if (bathsMatch) {
        result.baths = parseFloat(bathsMatch[1]);
      }
    }

    // Sqft
    if (meta.sqft) {
      const sqftMatch = String(meta.sqft).match(/(\d+)/);
      if (sqftMatch) {
        result.sqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
      }
    }

    // Features
    if (Array.isArray(meta.features)) {
      result.features = meta.features.map((f) => String(f)).filter(Boolean);
    }

    // Description
    if (meta.description) {
      result.description_raw = String(meta.description);
    }
  }

  // Fallback: Try to parse from HTML if available
  if (scraped.html && !result.address) {
    // Basic HTML parsing - can be enhanced with Cheerio
    // For MVP, we'll rely on browser extension metadata
    // TODO: Add server-side HTML parsing with Cheerio if needed
  }

  // Extract city/state/zip from address if available
  if (result.address) {
    const addressMatch = result.address.match(/(.+?),\s*(.+?),\s*([A-Z]{2})(?:\s+(\d{5}))?/i);
    if (addressMatch) {
      result.city = addressMatch[2].trim();
      result.state = addressMatch[3].trim().toUpperCase();
      if (addressMatch[4]) {
        result.zip = addressMatch[4].trim();
      }
    }
  }

  return result;
}

/**
 * Normalize scraped data to ListingJSON format
 */
function normalizeScrapedData(scraped: ScrapedData): ListingJSON {
  const parsed = parseScrapedData(scraped);

  return {
    source: {
      url: scraped.url,
      fetched_at: new Date().toISOString(),
      provider: "scrape",
      version: "v1",
    },
    listing: {
      address: parsed.address || "Unknown Address",
      city: parsed.city || "",
      state: parsed.state || "",
      zip: parsed.zip,
      price: parsed.price,
      price_currency: parsed.price_currency || "USD",
      price_type: parsed.price_type || "rent",
      beds: parsed.beds,
      baths: parsed.baths,
      sqft: parsed.sqft ?? null,
      features: parsed.features,
      description_raw: parsed.description_raw,
    },
  };
}

/**
 * Merge RentCast listing with scraped data
 * Prefers RentCast for structured fields, fills gaps from scraped data
 */
export function mergeListings(
  rentcast: ListingJSON,
  scraped: ListingJSON
): ListingJSON {
  const merged: ListingJSON = {
    ...rentcast,
    source: {
      ...rentcast.source,
      provider: "merge" as const,
    },
    listing: {
      ...rentcast.listing,
      // Prefer RentCast address, but use scraped if missing
      address: rentcast.listing.address || scraped.listing.address,
      city: rentcast.listing.city || scraped.listing.city,
      state: rentcast.listing.state || scraped.listing.state,
      zip: rentcast.listing.zip || scraped.listing.zip,
      // Prefer RentCast for structured data
      price: rentcast.listing.price ?? scraped.listing.price,
      price_currency: rentcast.listing.price_currency || scraped.listing.price_currency,
      price_type: rentcast.listing.price_type || scraped.listing.price_type,
      beds: rentcast.listing.beds ?? scraped.listing.beds,
      baths: rentcast.listing.baths ?? scraped.listing.baths,
      sqft: rentcast.listing.sqft ?? scraped.listing.sqft,
      // Merge features (deduplicate)
      features: [
        ...(rentcast.listing.features || []),
        ...(scraped.listing.features || []),
      ].filter((f, i, arr) => arr.indexOf(f) === i), // Deduplicate
      // Prefer scraped description if RentCast doesn't have one
      description_raw: rentcast.listing.description_raw || scraped.listing.description_raw,
    },
  };

  return merged;
}

/**
 * Get or create scraped listing data
 * Caches scraped data with short TTL (6 hours)
 */
export async function getScrapedListing(
  url: string,
  scrapedData?: ScrapedData
): Promise<ListingJSON | null> {
  // Feature flag check
  if (process.env.FEATURE_SCRAPE_FALLBACK !== "true") {
    return null;
  }

  const hash = urlHash(url);
  const version = "v1";

  // If scrapedData is provided, use it directly (from browser extension)
  if (scrapedData) {
    const normalized = normalizeScrapedData(scrapedData);
    // Cache it
    await getOrSet(
      cacheKey(CACHE_PREFIXES.SCRAPE, hash, version),
      CACHE_TTL.SCRAPE,
      async () => normalized
    );
    return normalized;
  }

  // Otherwise, try to get from cache
  return await getOrSet(
    cacheKey(CACHE_PREFIXES.SCRAPE, hash, version),
    CACHE_TTL.SCRAPE,
    async () => {
      // If no scraped data provided and not in cache, return null
      // Server-side scraping would go here (future enhancement)
      return null;
    }
  );
}

