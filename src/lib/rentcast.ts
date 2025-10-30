/**
 * RentCast API client
 * Primary data source for property listings
 */
import type { ListingJSON } from "@/types/listing";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "./cache";
import { addrHash } from "./hash";

const RENTCAST_API_BASE = "https://api.rentcast.io/v1";

export type RentCastResponse = {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  description?: string;
  features?: string[];
  // Add other RentCast fields as needed
};

/**
 * Retry configuration for RentCast API calls
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

/**
 * Exponential backoff with jitter
 */
async function delay(attempt: number): Promise<void> {
  const exponentialDelay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  const jitter = Math.random() * 1000; // 0-1 second jitter
  await new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
}

/**
 * Fetch property data from RentCast API
 */
async function fetchRentCastRaw(
  address: string
): Promise<RentCastResponse | null> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    throw new Error("RENTCAST_API_KEY environment variable is not set");
  }

  // RentCast API endpoint for property search
  const url = `${RENTCAST_API_BASE}/properties`;
  
  // Try by address first
  let response: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        // Add address as query parameter - adjust based on RentCast API docs
        // This is a placeholder - need to check actual RentCast API format
        next: { revalidate: CACHE_TTL.RENTCAST },
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(retryAfter) * 1000)
          );
        } else {
          await delay(attempt);
        }
        continue; // Retry
      }

      if (!response.ok) {
        if (response.status >= 500) {
          // Server error - retry
          await delay(attempt);
          continue;
        }
        // Client error (4xx) - don't retry
        throw new Error(`RentCast API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // RentCast may return an array or single object
      // Adjust based on actual API response format
      if (Array.isArray(data) && data.length > 0) {
        return data[0] as RentCastResponse;
      }
      if (data && typeof data === "object") {
        return data as RentCastResponse;
      }
      
      return null;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        await delay(attempt);
      }
    }
  }

  throw lastError || new Error("Failed to fetch from RentCast API");
}

/**
 * Normalize RentCast response to ListingJSON format
 */
function normalizeRentCastResponse(
  response: RentCastResponse,
  url?: string
): ListingJSON {
  return {
    source: {
      url,
      fetched_at: new Date().toISOString(),
      provider: "rentcast",
      version: "v1",
    },
    listing: {
      address: response.address,
      city: response.city,
      state: response.state,
      zip: response.zipCode,
      lat: response.latitude,
      lon: response.longitude,
      price: response.price,
      price_currency: "USD",
      price_type: response.propertyType?.toLowerCase().includes("rent")
        ? "rent"
        : "buy",
      beds: response.bedrooms,
      baths: response.bathrooms,
      sqft: response.squareFootage ?? null,
      year_built: response.yearBuilt ?? null,
      features: response.features,
      description_raw: response.description,
    },
  };
}

/**
 * Get or create property listing from RentCast
 * Uses cache to avoid duplicate API calls
 */
export async function getRentCastListing(
  address: string,
  url?: string
): Promise<ListingJSON | null> {
  const hash = addrHash(address);
  const version = "v1";
  
  // Try cache first
  const cached = await getOrSet(
    cacheKey(CACHE_PREFIXES.RENTCAST, hash, version),
    CACHE_TTL.RENTCAST,
    async () => {
      const response = await fetchRentCastRaw(address);
      if (!response) return null;
      
      // Cache the raw response
      return normalizeRentCastResponse(response, url);
    }
  );

  return cached;
}

/**
 * Check if listing has core fields required for processing
 */
export function hasCoreFields(listing: ListingJSON): boolean {
  const { listing: l } = listing;
  return !!(
    l.address &&
    l.city &&
    l.state &&
    (l.price !== undefined || l.beds !== undefined || l.baths !== undefined)
  );
}

