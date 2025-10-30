/**
 * OG Image route
 * GET /og/[slug].png
 * Returns OG image for social sharing
 */
import { NextResponse } from "next/server";
import { getSlugMapping } from "@/lib/storage";
import { getOrCreateOGImage } from "@/lib/og-image";

export const revalidate = 86400; // Revalidate every 24 hours

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const mapping = await getSlugMapping(slug);
    if (!mapping) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const { listing, report } = mapping;
    
    // Get prefsHash from the stored mapping if needed, or use default
    // For now, we'll reconstruct it from the listing if needed
    const prefsKey = "default"; // Could be stored in mapping if we need it
    
    // Get or create OG image (returns SVG buffer for now)
    const imageBuffer = await getOrCreateOGImage(listing, report, prefsKey);
    
    // For MVP, return SVG as-is
    // TODO: Convert SVG to PNG using @resvg/resvg-js for better compatibility
    // For now, SVG works for most social platforms
    
    return new NextResponse(imageBuffer.toString(), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("OG image generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

