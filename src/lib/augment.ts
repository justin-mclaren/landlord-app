/**
 * Augmentation module
 * Computes heuristics: geocode, noise, hazards, commute
 */
import type { ListingJSON } from "@/types/listing";
import type { AugmentJSON } from "@/types/augment";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "./cache";
import { addrHash } from "./hash";

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 * Free, no API key required
 */
async function geocodeNominatim(address: string): Promise<{
  lat: number;
  lon: number;
} | null> {
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Landlord Decoder (contact@example.com)", // Nominatim requires User-Agent
      },
      next: { revalidate: CACHE_TTL.AUGMENT },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Geocode an address using Mapbox (if token available)
 */
async function geocodeMapbox(address: string): Promise<{
  lat: number;
  lon: number;
} | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return null;
  }

  try {
    const encoded = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1`;
    
    const response = await fetch(url, {
      next: { revalidate: CACHE_TTL.AUGMENT },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [lon, lat] = data.features[0].center;
      return { lat, lon };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Geocode an address (try Mapbox first, fallback to Nominatim)
 */
async function geocodeAddress(address: string): Promise<{
  lat: number;
  lon: number;
  provider: "nominatim" | "mapbox";
} | null> {
  // Try Mapbox first if available
  const mapboxResult = await geocodeMapbox(address);
  if (mapboxResult) {
    return { ...mapboxResult, provider: "mapbox" };
  }

  // Fallback to Nominatim
  const nominatimResult = await geocodeNominatim(address);
  if (nominatimResult) {
    return { ...nominatimResult, provider: "nominatim" };
  }

  return null;
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest point from a list of coordinates
 */
function findNearestPoint(
  lat: number,
  lon: number,
  points: Array<{ lat: number; lon: number }>
): { distance: number; point: { lat: number; lon: number } } | null {
  if (points.length === 0) return null;

  let nearest = points[0];
  let minDistance = calculateDistance(lat, lon, nearest.lat, nearest.lon);

  for (const point of points.slice(1)) {
    const distance = calculateDistance(lat, lon, point.lat, point.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  }

  return { distance: minDistance, point: nearest };
}

/**
 * Compute noise level based on distance to motorways and airports
 * MVP: Simple distance-based heuristics
 */
async function computeNoiseLevel(
  lat: number,
  lon: number
): Promise<AugmentJSON["noise"]> {
  // TODO: In a real implementation, we'd query OSM or a geospatial database
  // for nearby motorways and airports. For MVP, we'll use simplified heuristics.
  
  // For now, return a placeholder that can be enhanced later
  // In production, you'd:
  // 1. Query OSM Overpass API for motorways within radius
  // 2. Query airport database (or OSM) for airports
  // 3. Calculate distances and assign tiers
  
  return {
    level: "medium", // Placeholder
    // motorway_distance_m: undefined,
    // airport_distance_m: undefined,
  };
}

/**
 * Compute hazard levels (flood, wildfire)
 * MVP: Return "unknown" unless we have specific data sources
 */
async function computeHazards(
  lat: number,
  lon: number
): Promise<AugmentJSON["hazards"]> {
  // TODO: In a real implementation, we'd query:
  // - FEMA flood maps
  // - Wildfire risk databases
  // - Other hazard data sources
  
  // For MVP, return "unknown" unless we have tokens/access to specific APIs
  return {
    flood: "unknown",
    wildfire: "unknown",
  };
}

/**
 * Compute commute time to work address
 * Uses Google Maps or Mapbox Directions API if available
 */
async function computeCommute(
  originLat: number,
  originLon: number,
  workAddress?: string
): Promise<AugmentJSON["commute"]> {
  if (!workAddress) {
    return undefined;
  }

  // Try to geocode work address
  const workLocation = await geocodeAddress(workAddress);
  if (!workLocation) {
    return {
      work_address: workAddress,
    };
  }

  // TODO: Use Google Maps Directions API or Mapbox Directions API
  // For MVP, we'll calculate a rough estimate based on straight-line distance
  const distanceKm = calculateDistance(
    originLat,
    originLon,
    workLocation.lat,
    workLocation.lon
  ) / 1000;

  // Rough estimate: assume average speed of 50 km/h in city
  const estimatedMinutes = Math.round((distanceKm / 50) * 60);
  const timeRange: [number, number] = [
    Math.max(5, Math.round(estimatedMinutes * 0.7)), // Min estimate
    Math.round(estimatedMinutes * 1.5), // Max estimate (with traffic)
  ];

  return {
    work_address: workAddress,
    driving_time_min: estimatedMinutes,
    driving_time_range: timeRange,
    provider: "estimate", // Placeholder - would be "google" or "mapbox" in production
  };
}

/**
 * Augment a property listing with geocode, noise, hazards, and commute data
 */
export async function augmentProperty(
  listing: ListingJSON,
  prefs?: { workAddress?: string }
): Promise<AugmentJSON> {
  const hash = addrHash(listing.listing.address);
  const version = "v1";

  return getOrSet(
    cacheKey(CACHE_PREFIXES.AUGMENT, hash, version),
    CACHE_TTL.AUGMENT,
    async () => {
      const augment: AugmentJSON = {
        computed_at: new Date().toISOString(),
        version,
      };

      // Get coordinates
      let lat: number | undefined = listing.listing.lat;
      let lon: number | undefined = listing.listing.lon;

      // Geocode if missing
      if (!lat || !lon) {
        const fullAddress = `${listing.listing.address}, ${listing.listing.city}, ${listing.listing.state} ${listing.listing.zip || ""}`.trim();
        const geocodeResult = await geocodeAddress(fullAddress);
        if (geocodeResult) {
          lat = geocodeResult.lat;
          lon = geocodeResult.lon;
          augment.geocode = geocodeResult;
        }
      } else {
        // Already have coordinates
        augment.geocode = {
          lat,
          lon,
          provider: "listing", // From original listing
        };
      }

      // Compute noise, hazards, and commute if we have coordinates
      if (lat && lon) {
        augment.noise = await computeNoiseLevel(lat, lon);
        augment.hazards = await computeHazards(lat, lon);
        augment.commute = await computeCommute(lat, lon, prefs?.workAddress);
      }

      return augment;
    }
  );
}

