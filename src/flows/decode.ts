/**
 * Decode Flow
 * Orchestrates the multi-step decode process
 *
 * Note: For MVP, this is a simple async function.
 * In production with Vercel Durable Workflows, this would be a workflow.
 */
import { normalizeInput, isFullAddress } from "@/lib/normalize";
import { getRentCastListing, hasCoreFields } from "@/lib/rentcast";
import {
  getScrapedListing,
  mergeListings,
  extractAddressFromZillowUrl,
} from "@/lib/scrape";
import { augmentProperty } from "@/lib/augment";
import { getOrCreateDecoderReport } from "@/lib/decoder";
import { getOrCreateOGImage } from "@/lib/og-image";
import { generateReportId, storeReportMapping } from "@/lib/storage";
import { addrHash, prefsHash } from "@/lib/hash";
import {
  NotFoundError,
  DataQualityError,
  ValidationError,
  normalizeError,
} from "@/lib/errors";
import type { DecodeFlowInput, DecodeFlowOutput } from "@/types/workflow";
import type { ListingJSON } from "@/types/listing";

export type DecodeStep =
  | "normalize"
  | "property"
  | "augment"
  | "report"
  | "og_image"
  | "publish"
  | "complete";

export type DecodeProgress = {
  step: DecodeStep;
  progress: number; // 0-1
  message?: string;
};

/**
 * Execute decode flow
 * Returns the report URL and slug
 */
export async function executeDecodeFlow(
  input: DecodeFlowInput,
  onProgress?: (progress: DecodeProgress) => void
): Promise<DecodeFlowOutput> {
  // Step 1: Normalize Input
  onProgress?.({
    step: "normalize",
    progress: 0.1,
    message: "Normalizing input...",
  });

  let normalized;
  try {
    normalized = await normalizeInput({
      url: input.url,
      address: input.address,
    });
  } catch (error) {
    throw new ValidationError(
      `Failed to normalize input: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "input",
      { url: input.url, address: input.address }
    );
  }

  // Step 2: Get or Create Property
  onProgress?.({
    step: "property",
    progress: 0.3,
    message: "Fetching property data...",
  });

  let listing: ListingJSON | null = null;
  const hasFullAddress = normalized.address
    ? isFullAddress(normalized.address)
    : false;

  // For Zillow URLs: if we only have city/state (not full address), try to extract address from page
  if (normalized.sourceMeta.url && !hasFullAddress) {
    const urlObj = new URL(normalized.sourceMeta.url);
    const isZillowUrl = urlObj.hostname.toLowerCase().includes("zillow.com");

    if (isZillowUrl) {
      onProgress?.({
        step: "property",
        progress: 0.32,
        message: "Extracting address from page...",
      });

      // Try to extract full address from Zillow page (from cached scraped data)
      // This doesn't require FEATURE_SCRAPE_FALLBACK - it only checks cache
      const extractedAddress = await extractAddressFromZillowUrl(
        normalized.sourceMeta.url
      );

      if (extractedAddress && isFullAddress(extractedAddress)) {
        // We got a full address from cached scraped data - use it with RentCast
        onProgress?.({
          step: "property",
          progress: 0.35,
          message: "Fetching property data...",
        });

        listing = await getRentCastListing(
          extractedAddress,
          normalized.sourceMeta.url
        );

        // If RentCast is missing fields, try merging with scraped data (if enabled)
        if (
          listing &&
          !hasCoreFields(listing) &&
          process.env.FEATURE_SCRAPE_FALLBACK === "true"
        ) {
          const scraped = await getScrapedListing(normalized.sourceMeta.url);
          if (scraped) {
            listing = mergeListings(listing, scraped);
            console.log(
              `Merged RentCast + scraped data for ${normalized.sourceMeta.url}`
            );
          }
        }
      } else if (process.env.FEATURE_SCRAPE_FALLBACK === "true") {
        // Couldn't extract address from cache - fall back to full scraping (if enabled)
        onProgress?.({
          step: "property",
          progress: 0.32,
          message: "Fetching property data from page...",
        });

        const scraped = await getScrapedListing(normalized.sourceMeta.url);
        if (scraped && hasCoreFields(scraped)) {
          listing = scraped;
        }
      }
      // If address extraction failed and scraping is disabled, listing will remain null
      // and we'll throw a helpful error below
    } else {
      // Not a Zillow URL and no full address - can't proceed
      throw new ValidationError(
        "Cannot process apartment URL without full address. " +
          "Please enable scraping fallback (FEATURE_SCRAPE_FALLBACK=true) or provide the full address.",
        "address",
        { url: normalized.sourceMeta.url }
      );
    }
  } else if (hasFullAddress) {
    // We have a full address - try RentCast first
    onProgress?.({
      step: "property",
      progress: 0.32,
      message: "Fetching property data...",
    });

    listing = await getRentCastListing(
      normalized.address,
      normalized.sourceMeta.url
    );
  }

  // If RentCast returned something but missing fields, try scraping fallback
  if (listing && !hasCoreFields(listing) && normalized.sourceMeta.url) {
    const { listing: l } = listing;
    const missingFields: string[] = [];
    if (!l.address) missingFields.push("address");
    if (!l.city) missingFields.push("city");
    if (!l.state) missingFields.push("state");
    if (!l.price && l.beds === undefined && l.baths === undefined) {
      missingFields.push("price/beds/baths");
    }

    // Try scraping fallback if enabled
    if (
      process.env.FEATURE_SCRAPE_FALLBACK === "true" &&
      normalized.sourceMeta.url
    ) {
      onProgress?.({
        step: "property",
        progress: 0.35,
        message: "Trying scraping fallback...",
      });

      const scraped = await getScrapedListing(normalized.sourceMeta.url);
      if (scraped) {
        // Merge RentCast + scraped data
        listing = mergeListings(listing, scraped);
        console.log(
          `Merged RentCast + scraped data for ${normalized.sourceMeta.url}`
        );
      }
    }

    // Check again after potential merge - only require address/city/state
    const { listing: mergedListing } = listing;
    if (!mergedListing.address || !mergedListing.city || !mergedListing.state) {
      const stillMissing: string[] = [];
      if (!mergedListing.address) stillMissing.push("address");
      if (!mergedListing.city) stillMissing.push("city");
      if (!mergedListing.state) stillMissing.push("state");
      
      throw new DataQualityError(
        `Property listing is still missing required location fields after scraping: ${stillMissing.join(", ")}`,
        stillMissing,
        {
          received: {
            address: mergedListing.address,
            city: mergedListing.city,
            state: mergedListing.state,
          },
        }
      );
    }
  }

  if (!listing) {
    // Provide helpful error message based on context
    if (normalized.sourceMeta.url) {
      const urlObj = new URL(normalized.sourceMeta.url);
      const isZillowUrl = urlObj.hostname.toLowerCase().includes("zillow.com");

      if (isZillowUrl && !hasFullAddress) {
        throw new ValidationError(
          "Zillow apartment URLs don't contain the full address in the URL. " +
            "To decode a specific apartment listing, you need either:\n" +
            "1. A browser extension that scrapes the page (posts to /api/ingestHtml)\n" +
            "2. Enable scraping fallback (FEATURE_SCRAPE_FALLBACK=true) with a scraping service\n" +
            "3. Provide the full address directly (street address + unit number)",
          "address",
          { url: normalized.sourceMeta.url, isZillowUrl: true }
        );
      }
    }

    throw new NotFoundError(
      "Property listing",
      normalized.address || normalized.sourceMeta.url,
      {
        address: normalized.address,
        url: normalized.sourceMeta.url,
        hasFullAddress,
      }
    );
  }

  // Validate minimum required fields (address, city, state)
  // Note: We allow listings without price/beds/baths - the decoder can handle partial data
  const { listing: l } = listing;
  if (!l.address || !l.city || !l.state) {
    const missingFields: string[] = [];
    if (!l.address) missingFields.push("address");
    if (!l.city) missingFields.push("city");
    if (!l.state) missingFields.push("state");

    throw new DataQualityError(
      "Property listing is missing required location fields (address, city, state)",
      missingFields,
      {
        received: {
          address: l.address,
          city: l.city,
          state: l.state,
        },
      }
    );
  }

  // Log warning if listing is missing key fields but allow it to proceed
  if (!l.price && l.beds === undefined && l.baths === undefined) {
    const hasActive = listing.source.has_active_listing;
    const status = listing.source.status;
    console.warn(
      `[decode] Listing for ${l.address} is missing price/beds/baths. ` +
      `RentCast returned property record ` +
      `(status: ${status || "unknown"}, has_active_listing: ${hasActive || false}). ` +
      `Proceeding with partial data - decoder will note missing information.`
    );
  }

  // Step 3: Augment Property
  onProgress?.({
    step: "augment",
    progress: 0.5,
    message: "Computing augmentation data...",
  });

  const augment = await augmentProperty(listing, input.prefs);

  // Step 4: Generate Decoder Report
  onProgress?.({
    step: "report",
    progress: 0.7,
    message: "Generating decoder report...",
  });

  const report = await getOrCreateDecoderReport(listing, augment, input.prefs);

  // Step 5: Generate OG Image (optional - skip if font loading fails)
  onProgress?.({
    step: "og_image",
    progress: 0.85,
    message: "Generating share image...",
  });

  const prefsKeyForOG = input.prefs ? prefsHash(input.prefs) : "default";
  try {
    await getOrCreateOGImage(listing, report, prefsKeyForOG);
  } catch (error) {
    console.warn("OG image generation failed (non-blocking):", error);
    // Continue without OG image - it's optional for MVP
  }

  // Step 6: Publish (Generate Unique ID)
  onProgress?.({
    step: "publish",
    progress: 0.95,
    message: "Finalizing...",
  });

  // Generate unique, non-guessable ID for this report
  const reportId = generateReportId();
  const reportUrl = `/d/${reportId}`;

  // Store report mapping for retrieval
  const addr = addrHash(listing.listing.address);
  const prefsKey = input.prefs ? prefsHash(input.prefs) : "default";
  await storeReportMapping(reportId, addr, prefsKey, listing, report, augment);

  onProgress?.({
    step: "complete",
    progress: 1.0,
    message: "Complete!",
  });

  return {
    reportUrl,
    slug: reportId, // Keep slug field for backward compatibility in types
  };
}

/**
 * Execute decode flow with error handling
 */
export async function executeDecodeFlowSafe(
  input: DecodeFlowInput,
  onProgress?: (progress: DecodeProgress) => void
): Promise<DecodeFlowOutput> {
  try {
    return await executeDecodeFlow(input, onProgress);
  } catch (error) {
    // Normalize error to ensure it's an AppError
    const normalizedError = normalizeError(error);

    // Log error with context
    console.error("Decode flow error:", {
      code: normalizedError.code,
      message: normalizedError.message,
      statusCode: normalizedError.statusCode,
      context: normalizedError.context,
      input: {
        hasUrl: !!input.url,
        hasAddress: !!input.address,
      },
    });

    throw normalizedError;
  }
}
