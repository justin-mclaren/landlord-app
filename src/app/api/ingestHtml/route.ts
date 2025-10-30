/**
 * Browser Extension Endpoint
 * POST /api/ingestHtml
 * Accepts HTML/DOM data from browser extension and caches it
 */

import { NextResponse } from "next/server";
import { getScrapedListing } from "@/lib/scrape";
import type { ScrapedData } from "@/lib/scrape";
import {
  ValidationError,
  ConfigurationError,
  ParseError,
  normalizeError,
  getStatusCode,
  getUserMessage,
  getErrorCode,
} from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingestHtml
 * Body: { url: string, html?: string, dom?: Record<string, unknown>, metadata?: {...} }
 */
export async function POST(request: Request) {
  try {
    let body: any;
    
    // Parse request body
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError(
        "Invalid JSON in request body",
        "body",
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }

    // Validate required fields
    if (!body.url || typeof body.url !== "string") {
      throw new ValidationError(
        "Missing or invalid 'url' field",
        "url"
      );
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      throw new ValidationError(
        "Invalid URL format",
        "url",
        { providedUrl: body.url }
      );
    }

    // Feature flag check
    if (process.env.FEATURE_SCRAPE_FALLBACK !== "true") {
      throw new ConfigurationError(
        "FEATURE_SCRAPE_FALLBACK",
        { url: body.url }
      );
    }

    // Prepare scraped data
    const scrapedData: ScrapedData = {
      url: body.url,
      html: body.html,
      dom: body.dom,
      metadata: body.metadata,
    };

    // Cache the scraped data
    let listing;
    try {
      listing = await getScrapedListing(body.url, scrapedData);
    } catch (error) {
      throw new ParseError(
        "Failed to parse scraped data",
        "scraped_data",
        {
          url: body.url,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }

    if (!listing) {
      throw new ParseError(
        "Failed to extract listing data from scraped content",
        "scraped_data",
        { url: body.url }
      );
    }

    return NextResponse.json({
      success: true,
      url: body.url,
      cached: true,
      listing: {
        address: listing.listing.address,
        city: listing.listing.city,
        state: listing.listing.state,
        price: listing.listing.price,
        beds: listing.listing.beds,
        baths: listing.listing.baths,
        sqft: listing.listing.sqft,
      },
    });
  } catch (error) {
    const normalizedError = normalizeError(error);
    const statusCode = getStatusCode(normalizedError);
    const errorCode = getErrorCode(normalizedError);
    const userMessage = getUserMessage(normalizedError);

    // Log error with context
    console.error("Error ingesting HTML:", {
      code: errorCode,
      message: normalizedError.message,
      statusCode,
      context: normalizedError.context,
    });

    return NextResponse.json(
      {
        error: userMessage,
        code: errorCode,
        ...(normalizedError.context && { context: normalizedError.context }),
      },
      { status: statusCode }
    );
  }
}
