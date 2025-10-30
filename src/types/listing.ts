/**
 * Normalized listing data structure
 * This is the canonical format used throughout the application
 */
export type ListingJSON = {
  source: {
    url?: string;
    fetched_at: string;
    provider: "rentcast" | "scrape" | "merge";
    version?: string; // Schema version for cache busting
  };
  listing: {
    address: string;
    city: string;
    state: string;
    zip?: string;
    lat?: number;
    lon?: number;
    price?: number;
    price_currency?: "USD";
    price_type?: "rent" | "buy";
    beds?: number;
    baths?: number;
    sqft?: number | null;
    year_built?: number | null;
    features?: string[];
    description_raw?: string;
  };
};

