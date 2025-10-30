/**
 * Decode Flow
 * Orchestrates the multi-step decode process
 * 
 * Note: For MVP, this is a simple async function.
 * In production with Vercel Durable Workflows, this would be a workflow.
 */
import { normalizeInput } from "@/lib/normalize";
import { getRentCastListing, hasCoreFields } from "@/lib/rentcast";
import { augmentProperty } from "@/lib/augment";
import { getOrCreateDecoderReport } from "@/lib/decoder";
import { getOrCreateOGImage } from "@/lib/og-image";
import { generateSlugFromReport } from "@/lib/slug";
import { storeSlugMapping } from "@/lib/storage";
import { addrHash, prefsHash } from "@/lib/hash";
import type { DecodeFlowInput, DecodeFlowOutput } from "@/types/workflow";
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";

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

  const listing = await getRentCastListing(
    normalized.address,
    normalized.sourceMeta.url
  );

  if (!listing) {
    throw new Error("Could not find property listing");
  }

  if (!hasCoreFields(listing)) {
    throw new Error("Property listing is missing required fields");
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

  // Step 5: Generate OG Image
  onProgress?.({
    step: "og_image",
    progress: 0.85,
    message: "Generating share image...",
  });

  const prefsKeyForOG = input.prefs
    ? JSON.stringify(input.prefs)
    : "default";
  await getOrCreateOGImage(listing, report, prefsKeyForOG);

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

