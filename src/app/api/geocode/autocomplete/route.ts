/**
 * GET /api/geocode/autocomplete
 * Address autocomplete endpoint using Mapbox Geocoding API
 */

import { NextResponse } from "next/server";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const countryCode = searchParams.get("country"); // Optional ISO 3166-1 alpha-2 country code (e.g., "US", "CA", "GB")

  console.log("Autocomplete API called with query:", query, "country:", countryCode);

  if (!query || query.trim().length < 2) {
    console.log("Query too short or missing");
    return NextResponse.json(
      { error: "Query parameter 'q' is required and must be at least 2 characters", suggestions: [] },
      { status: 400 }
    );
  }

  // If Mapbox token is not configured, fall back to Nominatim (free, no API key)
  if (!MAPBOX_TOKEN) {
    console.log("MAPBOX_TOKEN not configured, using Nominatim fallback");
    
    try {
      // Use Nominatim for autocomplete (free, no API key required)
      const encodedQuery = encodeURIComponent(query.trim());
      // Add country filter if provided
      const countryParam = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : "";
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1${countryParam}`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "Landlord Decoder (contact@example.com)", // Nominatim requires User-Agent
        },
      });

      if (!response.ok) {
        console.error("Nominatim API error:", response.status);
        return NextResponse.json({ suggestions: [] });
      }

      const data = await response.json();
      
      // Transform Nominatim response to our format
      const suggestions = (data || []).map((item: any) => ({
        place_name: item.display_name,
        center: [parseFloat(item.lon), parseFloat(item.lat)],
        context: [],
      }));

      console.log("Nominatim returned", suggestions.length, "suggestions");
      return NextResponse.json({ suggestions });
    } catch (error) {
      console.error("Nominatim fallback error:", error);
      return NextResponse.json({ suggestions: [] });
    }
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    // Add country filter if provided (Mapbox uses ISO 3166-1 alpha-2 codes)
    const countryParam = countryCode ? `&country=${countryCode.toUpperCase()}` : "";
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=address,poi${countryParam}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mapbox API error:", response.status, response.statusText, errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch address suggestions",
          details: errorText,
          suggestions: [] 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log("Mapbox API response:", {
      query,
      featureCount: data.features?.length || 0,
      hasFeatures: !!data.features
    });

    // Transform Mapbox response to our format
    const suggestions = (data.features || []).map((feature: any) => ({
      place_name: feature.place_name,
      center: feature.center,
      context: feature.context,
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Geocode autocomplete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

