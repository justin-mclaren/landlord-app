/**
 * GET /api/places/nearby
 * Proxy for Google Places API Nearby Search
 * Server-side only to avoid CORS issues
 */

import { NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const type = searchParams.get("type");
  const radius = searchParams.get("radius");

  if (!lat || !lon || !type) {
    return NextResponse.json(
      { error: "Missing required parameters: lat, lon, type" },
      { status: 400 }
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  try {
    const radiusMeters = radius ? parseInt(radius, 10) : 2000;
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radiusMeters}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch places data" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Places API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


