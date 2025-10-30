/**
 * RentCast API client
 * Primary data source for property listings
 */
import type { ListingJSON } from "@/types/listing";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "./cache";
import { addrHash } from "./hash";
import {
  APIError,
  RateLimitError,
  ConfigurationError,
  NotFoundError,
  TimeoutError,
} from "./errors";

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
    throw new ConfigurationError("RENTCAST_API_KEY", { address });
  }

  // RentCast API endpoint for property search
  // Build URL with address as query parameter
  const urlParams = new URLSearchParams({
    address: address,
  });
  const url = `${RENTCAST_API_BASE}/properties?${urlParams.toString()}`;
  
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
        next: { revalidate: CACHE_TTL.RENTCAST },
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : undefined;
        
        if (attempt < RETRY_CONFIG.maxRetries - 1) {
          if (retryAfterSeconds) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfterSeconds * 1000)
            );
          } else {
            await delay(attempt);
          }
          continue; // Retry
        } else {
          // Max retries reached
          throw new RateLimitError("RentCast", retryAfterSeconds, { address });
        }
      }

      if (!response.ok) {
        if (response.status >= 500) {
          // Server error - retry
          if (attempt < RETRY_CONFIG.maxRetries - 1) {
            await delay(attempt);
            continue;
          }
          // Max retries reached
          let errorMessage = `${response.status} ${response.statusText}`;
          try {
            const errorData = await response.clone().json();
            if (errorData.message || errorData.error) {
              errorMessage = errorData.message || errorData.error;
            }
          } catch {
            // Ignore JSON parse errors
          }
          throw new APIError("RentCast", errorMessage, undefined, response.status, { address });
        }
        
        // Client error (4xx) - don't retry
        if (response.status === 404) {
          // Property not found
          return null;
        }
        
        // Other 4xx errors
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
          const errorData = await response.clone().json();
          if (errorData.message || errorData.error) {
            errorMessage = errorData.message || errorData.error;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new APIError("RentCast", errorMessage, undefined, response.status, { address });
      }

      const data = await response.json();
      
      // RentCast may return an array or single object
      // Adjust based on actual API response format
      if (Array.isArray(data)) {
        if (data.length > 0) {
          return data[0] as RentCastResponse;
        }
        // Empty array means no results found
        return null;
      }
      if (data && typeof data === "object") {
        // Check if it's an error response
        if (data.error || data.message) {
          throw new APIError(
            "RentCast",
            data.error || data.message,
            undefined,
            response.status,
            { address }
          );
        }
        return data as RentCastResponse;
      }
      
      return null;
    } catch (error) {
      // Don't retry non-retryable errors
      if (
        error instanceof APIError &&
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        error.statusCode !== 429
      ) {
        throw error;
      }
      
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        await delay(attempt);
      }
    }
  }

  // If we get here, all retries failed
  if (lastError instanceof APIError || lastError instanceof RateLimitError) {
    throw lastError;
  }
  
  throw new APIError(
    "RentCast",
    lastError?.message || "Failed to fetch from RentCast API after retries",
    lastError || undefined,
    502,
    { address }
  );
}

/**
 * Normalize RentCast response to ListingJSON format
 */
function normalizeRentCastResponse(
  response: RentCastResponse,
  url?: string,
  inputAddress?: string
): ListingJSON {
  // Build address from available fields or use input address as fallback
  let address = response.address;
  if (!address && inputAddress) {
    // Use input address if RentCast doesn't provide it
    address = inputAddress;
  } else if (!address && response.city && response.state) {
    // Build minimal address from city/state if we have them
    address = `${response.city}, ${response.state}`;
  }
  
  return {
    source: {
      url,
      fetched_at: new Date().toISOString(),
      provider: "rentcast",
      version: "v1",
    },
    listing: {
      address: address || "Unknown Address",
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
      
      // Cache the raw response, passing input address as fallback
      return normalizeRentCastResponse(response, url, address);
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

