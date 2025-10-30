/**
 * POST /api/decode
 * Main decode endpoint - starts the decode workflow
 */
import { NextResponse } from "next/server";
import { normalizeInput } from "@/lib/normalize";
import { getRentCastListing, hasCoreFields } from "@/lib/rentcast";
import type { DecodeFlowInput } from "@/types/workflow";

export async function POST(request: Request) {
  try {
    const body: DecodeFlowInput = await request.json();
    
    // Validate input
    if (!body.url && !body.address) {
      return NextResponse.json(
        { error: "Either url or address must be provided" },
        { status: 400 }
      );
    }

    // Normalize input
    const normalized = await normalizeInput({
      url: body.url,
      address: body.address,
    });

    // For MVP, we'll do a simple synchronous flow
    // Later, this will trigger a Durable Workflow
    const listing = await getRentCastListing(
      normalized.address,
      normalized.sourceMeta.url
    );

    if (!listing) {
      return NextResponse.json(
        { error: "Could not find property listing" },
        { status: 404 }
      );
    }

    if (!hasCoreFields(listing)) {
      return NextResponse.json(
        { error: "Property listing is missing required fields" },
        { status: 400 }
      );
    }

    // TODO: Continue with augmentation, AI decoding, OG image generation
    // For now, return a placeholder response
    return NextResponse.json({
      status: "ok",
      url: "/d/placeholder-slug", // TODO: Generate actual slug
      message: "Decode workflow started (placeholder - full workflow not yet implemented)",
    });
  } catch (error) {
    console.error("Decode error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

