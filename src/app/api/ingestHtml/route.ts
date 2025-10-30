/**
 * Browser Extension Endpoint
 * POST /api/ingestHtml
 * Accepts HTML/DOM data from browser extension and caches it
 */

import { NextResponse } from "next/server";
import { getScrapedListing } from "@/lib/scrape";
import type { ScrapedData } from "@/lib/scrape";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingestHtml
 * Body: { url: string, html?: string, dom?: Record<string, unknown>, metadata?: {...} }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' field" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Feature flag check
    if (process.env.FEATURE_SCRAPE_FALLBACK !== "true") {
      return NextResponse.json(
        { error: "Scraping fallback is not enabled" },
        { status: 503 }
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
    const listing = await getScrapedListing(body.url, scrapedData);

    if (!listing) {
      return NextResponse.json(
        { error: "Failed to parse scraped data" },
        { status: 500 }
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
    console.error("Error ingesting HTML:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

