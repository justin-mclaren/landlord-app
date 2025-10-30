/**
 * Decode Flow
 * Orchestrates the multi-step decode process
 *
 * Note: For MVP, this is a simple async function.
 * In production with Vercel Durable Workflows, this would be a workflow.
 */
import { normalizeInput } from "@/lib/normalize";
import { getRentCastListing, hasCoreFields } from "@/lib/rentcast";
import { getScrapedListing, mergeListings } from "@/lib/scrape";
import { augmentProperty } from "@/lib/augment";
import { getOrCreateDecoderReport } from "@/lib/decoder";
import { getOrCreateOGImage } from "@/lib/og-image";
import { generateSlugFromReport } from "@/lib/slug";
import { storeSlugMapping } from "@/lib/storage";
import { addrHash, prefsHash } from "@/lib/hash";
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

  const normalized = await normalizeInput({
    url: input.url,
    address: input.address,
  });

  // Step 2: Get or Create Property
  onProgress?.({
    step: "property",
    progress: 0.3,
    message: "Fetching property data...",
  });

  let listing: ListingJSON | null = null;

  // If we have a URL but no address extracted, try scraping first
  if (normalized.sourceMeta.url && !normalized.address && process.env.FEATURE_SCRAPE_FALLBACK === "true") {
    onProgress?.({
      step: "property",
      progress: 0.32,
      message: "Checking scraped data...",
    });
    
    const scraped = await getScrapedListing(normalized.sourceMeta.url);
    if (scraped && hasCoreFields(scraped)) {
      listing = scraped;
    }
  }

  // Try RentCast if we have an address or if scraping didn't work
  if (!listing && normalized.address) {
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

    // Check again after potential merge
    if (!hasCoreFields(listing)) {
      const { listing: mergedListing } = listing;
      throw new Error(
        `Property listing is missing required fields: ${missingFields.join(
          ", "
        )}. ` +
          `Received: ${JSON.stringify({
            address: mergedListing.address,
            city: mergedListing.city,
            state: mergedListing.state,
            price: mergedListing.price,
            beds: mergedListing.beds,
            baths: mergedListing.baths,
          })}`
      );
    }
  }

  // Final check: if we still don't have a listing, try scraping as last resort
  if (!listing && normalized.sourceMeta.url && process.env.FEATURE_SCRAPE_FALLBACK === "true") {
    onProgress?.({
      step: "property",
      progress: 0.38,
      message: "Trying scraping fallback...",
    });

    listing = await getScrapedListing(normalized.sourceMeta.url);
  }

  if (!listing) {
    throw new Error(
      `Could not find property listing. ${normalized.sourceMeta.url ? "Try enabling scraping fallback (FEATURE_SCRAPE_FALLBACK=true) or provide the full address." : "Please provide a valid URL or address."}`
    );
  }

  if (!hasCoreFields(listing)) {
    const { listing: l } = listing;
    throw new Error(
      `Property listing is missing required fields. ` +
        `Received: ${JSON.stringify({
          address: l.address,
          city: l.city,
          state: l.state,
          price: l.price,
          beds: l.beds,
          baths: l.baths,
        })}`
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

  // Step 6: Publish (Generate Slug)
  onProgress?.({
    step: "publish",
    progress: 0.95,
    message: "Finalizing...",
  });

  const slug = generateSlugFromReport(listing, report);
  const reportUrl = `/d/${slug}`;

  // Store slug mapping for retrieval
  const addr = addrHash(listing.listing.address);
  const prefsKey = input.prefs ? prefsHash(input.prefs) : "default";
  await storeSlugMapping(slug, addr, prefsKey, listing, report);

  onProgress?.({
    step: "complete",
    progress: 1.0,
    message: "Complete!",
  });

  return {
    reportUrl,
    slug,
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
    console.error("Decode flow error:", error);
    throw error;
  }
}
