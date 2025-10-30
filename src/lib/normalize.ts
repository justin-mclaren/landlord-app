/**
 * Address normalization utilities
 * Converts user input (URL or address string) into canonical format
 */

export type NormalizedInput = {
  address: string;
  sourceMeta: {
    url?: string;
    input_type: "url" | "address";
    parsed_from_url?: boolean;
  };
};

/**
 * Extract address from common rental listing URLs
 */
function extractAddressFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Zillow: multiple URL patterns
    if (hostname.includes("zillow.com")) {
      // Pattern 1: /homedetails/123-Main-St-City-ST-12345/...
      const homedetailsMatch = urlObj.pathname.match(/\/homedetails\/([^/]+)/);
      if (homedetailsMatch) {
        const addressPart = decodeURIComponent(homedetailsMatch[1])
          .replace(/-/g, " ")
          .trim();
        return addressPart;
      }

      // Pattern 2: /apartments/city-state/property-name/ID/
      // For apartment listings, address isn't in URL - need to scrape or use address param
      // Check query params for address
      const addressParam = urlObj.searchParams.get("address") || urlObj.searchParams.get("addr");
      if (addressParam) {
        return addressParam;
      }

      // Pattern 3: Try to extract city/state from path as fallback
      // /apartments/costa-mesa-ca/... -> "Costa Mesa, CA"
      const apartmentsMatch = urlObj.pathname.match(/\/apartments\/([^/]+)/);
      if (apartmentsMatch) {
        const cityState = apartmentsMatch[1]
          .replace(/-/g, " ")
          .replace(/\bca\b/i, "CA")
          .replace(/\bny\b/i, "NY")
          .replace(/\btx\b/i, "TX")
          .trim();
        // Return partial address (city, state) - will need full address from RentCast or scraping
        // For now, return null to trigger scraping fallback
        return null;
      }
    }

    // Apartments.com: similar pattern
    if (hostname.includes("apartments.com")) {
      const pathMatch = urlObj.pathname.match(/\/([^/]+)$/);
      if (pathMatch) {
        const addressPart = decodeURIComponent(pathMatch[1])
          .replace(/-/g, " ")
          .trim();
        return addressPart;
      }
    }

    // Generic: try to extract from pathname
    // This is a basic implementation - can be enhanced
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize address string to canonical format
 */
function normalizeAddressString(address: string): string {
  let normalized = address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Replace multiple spaces with single space

  // Standardize common abbreviations
  const abbreviations: Record<string, string> = {
    " st ": " street ",
    " st.": " street",
    " st": " street",
    " ave ": " avenue ",
    " ave.": " avenue",
    " ave": " avenue",
    " blvd ": " boulevard ",
    " blvd.": " boulevard",
    " blvd": " boulevard",
    " rd ": " road ",
    " rd.": " road",
    " rd": " road",
    " dr ": " drive ",
    " dr.": " drive",
    " dr": " drive",
    " ln ": " lane ",
    " ln.": " lane",
    " ln": " lane",
    " ct ": " court ",
    " ct.": " court",
    " ct": " court",
    " apt ": " apartment ",
    " apt.": " apartment",
    " apt": " apartment",
    " unit ": " ",
    " unit.": "",
    " unit": "",
  };

  for (const [abbr, full] of Object.entries(abbreviations)) {
    normalized = normalized.replace(new RegExp(abbr, "gi"), full);
  }

  return normalized.trim();
}

/**
 * Parse address string into components
 * Basic implementation - can be enhanced with a proper address parser
 */
function parseAddress(address: string): {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
} {
  // Try to match common US address formats
  // Format: "123 Main St, City, ST 12345" or "123 Main St, City, ST"
  const match = address.match(
    /^(.+?),\s*(.+?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/i
  );

  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3].trim().toUpperCase(),
      zip: match[4]?.trim(),
    };
  }

  // Fallback: return as-is
  return {
    street: address.trim(),
  };
}

/**
 * Normalize user input (URL or address) into canonical format
 */
export async function normalizeInput(input: {
  url?: string;
  address?: string;
}): Promise<NormalizedInput> {
  if (input.url) {
    // Try to extract address from URL
    const extractedAddress = extractAddressFromUrl(input.url);
    
    if (extractedAddress) {
      return {
        address: normalizeAddressString(extractedAddress),
        sourceMeta: {
          url: input.url,
          input_type: "url",
          parsed_from_url: true,
        },
      };
    }
    
    // If URL extraction fails, try to use address if provided
    if (input.address) {
      return {
        address: normalizeAddressString(input.address),
        sourceMeta: {
          url: input.url,
          input_type: "address",
          parsed_from_url: false,
        },
      };
    }
    
    // If we can't extract, throw error
    throw new Error("Could not extract address from URL");
  }

  if (input.address) {
    return {
      address: normalizeAddressString(input.address),
      sourceMeta: {
        input_type: "address",
        parsed_from_url: false,
      },
    };
  }

  throw new Error("Either url or address must be provided");
}

/**
 * Validate that a normalized address has required fields
 */
export function validateAddress(address: string): boolean {
  const parsed = parseAddress(address);
  // At minimum, we need street and city
  return !!(parsed.street && parsed.city);
}

