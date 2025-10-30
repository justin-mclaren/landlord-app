/**
 * Scraping fallback module
 * Parses HTML/DOM data from browser extension or server-side scraping
 * Used when RentCast API is missing core fields
 */

import type { ListingJSON } from "@/types/listing";
import { urlHash } from "@/lib/hash";
import { cacheKey, CACHE_PREFIXES, CACHE_TTL, get, set } from "@/lib/cache";
import { isFullAddress } from "@/lib/normalize";

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
function parseScrapedData(
  scraped: ScrapedData
): Partial<ListingJSON["listing"]> {
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
        if (
          priceLower.includes("rent") ||
          priceLower.includes("/month") ||
          priceLower.includes("/mo")
        ) {
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
    const addressMatch = result.address.match(
      /(.+?),\s*(.+?),\s*([A-Z]{2})(?:\s+(\d{5}))?/i
    );
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
      price_currency:
        rentcast.listing.price_currency || scraped.listing.price_currency,
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
      description_raw:
        rentcast.listing.description_raw || scraped.listing.description_raw,
    },
  };

  return merged;
}

/**
 * Extract just the address from a Zillow URL
 * Checks cached scraped data first, then tries to get from browser extension cache
 * If not cached, attempts lightweight server-side fetch to extract address from HTML
 * Returns the address string if found, null otherwise
 *
 * This allows us to derive an address from a Zillow URL and then use it with RentCast
 * Note: This function checks cache without requiring FEATURE_SCRAPE_FALLBACK.
 *       Only actual scraping operations require the feature flag.
 */
export async function extractAddressFromZillowUrl(
  url: string
): Promise<string | null> {
  // Only work with Zillow URLs
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.toLowerCase().includes("zillow.com")) {
      return null;
    }
  } catch {
    return null;
  }

  const hash = urlHash(url);
  const version = "v1";
  const cacheKeyStr = cacheKey(CACHE_PREFIXES.SCRAPE, hash, version);

  try {
    // Check if we already have scraped data cached for this URL
    // This doesn't require FEATURE_SCRAPE_FALLBACK - it's just reading cache
    const cached = await get<ListingJSON>(cacheKeyStr);
    if (
      cached &&
      cached.listing.address &&
      isFullAddress(cached.listing.address)
    ) {
      return cached.listing.address;
    }
  } catch {
    // Continue to try other methods
  }

  // Try to get from browser extension cache (via getScrapedListing)
  // This checks if browser extension has already scraped and cached this URL
  // getScrapedListing will handle the feature flag check for actual scraping
  const scraped = await getScrapedListing(url);
  if (
    scraped &&
    scraped.listing.address &&
    isFullAddress(scraped.listing.address)
  ) {
    return scraped.listing.address;
  }

  // For Zillow apartment URLs, we cannot derive a specific unit address
  // from just the building name + city/state. We need either:
  // 1. Browser extension to scrape the actual address from the page
  // 2. Scraping service (with FEATURE_SCRAPE_FALLBACK=true)
  // 3. User to provide the full address directly
  
  // If not in cache, try lightweight server-side fetch to extract address
  // This is a minimal operation (just fetch HTML and extract address)
  // Doesn't require full scraping feature flag
  // Note: Zillow often blocks server-side requests with CAPTCHA
  console.log(`Attempting to fetch address from Zillow URL: ${url}`);
  try {
    const address = await fetchZillowAddress(url);
    if (address && isFullAddress(address)) {
      console.log(`Successfully extracted address: ${address}`);
      // Cache the extracted address for future use
      // Create a minimal listing structure just for caching
      const minimalListing: ListingJSON = {
        source: {
          url,
          fetched_at: new Date().toISOString(),
          provider: "scrape",
          version: "v1",
        },
        listing: {
          address,
          city: "",
          state: "",
          price: undefined,
          price_currency: "USD",
          price_type: "rent",
          beds: undefined,
          baths: undefined,
          sqft: undefined,
          features: [],
          description_raw: undefined,
        },
      };
      // Cache it (even though it's incomplete - just for address lookup)
      await set(cacheKeyStr, minimalListing, { ttl: CACHE_TTL.SCRAPE });
      return address;
    }
  } catch (error) {
    // If fetch failed (e.g., CAPTCHA), log and return null
    // The error will be handled by the calling code
    console.warn(
      `Failed to fetch address from Zillow URL ${url}:`,
      error instanceof Error ? error.message : error
    );
  }

  console.log(`Failed to extract address from Zillow URL: ${url}`);
  return null;
}

/**
 * Lightweight fetch of Zillow page HTML to extract address
 * Only extracts the address, doesn't parse full listing data
 */
async function fetchZillowAddress(url: string): Promise<string | null> {
  try {
    console.log(`Fetching Zillow page for address extraction: ${url}`);

    // Use a timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Zillow fetch failed with status ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes from Zillow page`);

    // Check if Zillow returned a CAPTCHA page instead of the property page
    if (
      html.includes("px-captcha") ||
      html.includes("Before we continue") ||
      html.includes("Press & Hold")
    ) {
      console.warn(
        `Zillow returned CAPTCHA page for ${url} - server-side scraping blocked`
      );
      throw new Error(
        "Zillow blocked the request with a CAPTCHA. " +
          "Server-side scraping is not available for Zillow URLs. " +
          "Please use a browser extension to scrape the page, or enable scraping fallback with a scraping service."
      );
    }

    // Try to extract address from common Zillow patterns
    // Pattern 1: JSON-LD structured data
    const jsonLdMatch = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.address?.streetAddress) {
          const address = `${jsonLd.address.streetAddress}, ${jsonLd.address.addressLocality}, ${jsonLd.address.addressRegion}`;
          console.log(`Found address in JSON-LD: ${address}`);
          if (isFullAddress(address)) {
            return address;
          }
        }
      } catch (e) {
        console.warn("Failed to parse JSON-LD:", e);
        // Continue to try other patterns
      }
    }

    // Pattern 2: data-testid="property-address" or similar
    const addressMatch = html.match(
      /data-testid=["']property-address["'][^>]*>([^<]+)/i
    );
    if (addressMatch) {
      const address = addressMatch[1].trim();
      console.log(`Found address in data-testid: ${address}`);
      if (isFullAddress(address)) {
        return address;
      }
    }

    // Pattern 3: itemprop="streetAddress" or similar
    const itempropMatch = html.match(
      /itemprop=["']streetAddress["'][^>]*content=["']([^"']+)["']/i
    );
    if (itempropMatch) {
      const street = itempropMatch[1].trim();
      // Try to find city/state nearby
      const cityStateMatch = html.match(
        /itemprop=["']addressLocality["'][^>]*content=["']([^"']+)["'][^>]*itemprop=["']addressRegion["'][^>]*content=["']([^"']+)["']/i
      );
      if (cityStateMatch) {
        const address = `${street}, ${cityStateMatch[1]}, ${cityStateMatch[2]}`;
        console.log(`Found address in itemprop: ${address}`);
        if (isFullAddress(address)) {
          return address;
        }
      }
    }

    // Pattern 4: Look for address in meta tags
    const metaAddressMatch = html.match(
      /<meta[^>]*property=["']og:street-address["'][^>]*content=["']([^"']+)["']/i
    );
    if (metaAddressMatch) {
      const street = metaAddressMatch[1].trim();
      const metaLocalityMatch = html.match(
        /<meta[^>]*property=["']og:locality["'][^>]*content=["']([^"']+)["']/i
      );
      const metaRegionMatch = html.match(
        /<meta[^>]*property=["']og:region["'][^>]*content=["']([^"']+)["']/i
      );
      if (metaLocalityMatch && metaRegionMatch) {
        const address = `${street}, ${metaLocalityMatch[1]}, ${metaRegionMatch[1]}`;
        console.log(`Found address in meta tags: ${address}`);
        if (isFullAddress(address)) {
          return address;
        }
      }
    }

    console.warn(
      "Could not extract address from Zillow HTML using any pattern"
    );
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`Request timeout fetching Zillow URL: ${url}`);
      return null;
    } else {
      // Re-throw the error so it can be handled upstream
      console.error(`Error fetching Zillow address for ${url}:`, error);
      throw error;
    }
  }
}

/**
 * Get or create scraped listing data
 * Caches scraped data with short TTL (6 hours)
 *
 * Note: Cache reads don't require FEATURE_SCRAPE_FALLBACK.
 *       Only actual scraping operations require the feature flag.
 */
export async function getScrapedListing(
  url: string,
  scrapedData?: ScrapedData
): Promise<ListingJSON | null> {
  const hash = urlHash(url);
  const version = "v1";
  const cacheKeyStr = cacheKey(CACHE_PREFIXES.SCRAPE, hash, version);

  // If scrapedData is provided (from browser extension), cache it immediately
  // This doesn't require FEATURE_SCRAPE_FALLBACK - it's just caching user-provided data
  if (scrapedData) {
    const normalized = normalizeScrapedData(scrapedData);
    // Cache it
    await set(cacheKeyStr, normalized, { ttl: CACHE_TTL.SCRAPE });
    return normalized;
  }

  // Try to get from cache first (no feature flag required for cache reads)
  try {
    const cached = await get<ListingJSON>(cacheKeyStr);
    if (cached) {
      return cached;
    }
  } catch {
    // Continue to try other methods
  }

  // If not in cache and no scrapedData provided, require feature flag for scraping
  if (process.env.FEATURE_SCRAPE_FALLBACK !== "true") {
    return null;
  }

  // Future: Server-side scraping would go here
  // For now, return null if not in cache and no scrapedData provided
  return null;
}
