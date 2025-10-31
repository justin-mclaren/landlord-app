/**
 * Location Insights module
 * Computes location-based data: sex offender registry, nearby amenities, schools, transit
 */
import type { AugmentJSON } from "@/types/augment";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "./cache";
import { addrHash } from "./hash";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const FAMILY_WATCHDOG_API_KEY = process.env.FAMILY_WATCHDOG_API_KEY;
const FAMILY_WATCHDOG_API_URL = "https://www.familywatchdog.us/api/search";

/**
 * Family Watchdog API response type
 */
type FamilyWatchdogResponse = {
  success: boolean;
  count?: number;
  offenders?: Array<{
    id?: string;
    name?: string;
    address?: string;
    distance?: number;
    [key: string]: unknown;
  }>;
  error?: string;
};

/**
 * Query Family Watchdog API for sex offenders near an address
 * Based on Family Watchdog API documentation: https://www.familywatchdog.us/APIHow.asp
 */
async function queryFamilyWatchdogAPI(
  address: string,
  lat: number,
  lon: number,
  radiusMiles: number = 2
): Promise<{ count: number; offenders?: Array<unknown> } | null> {
  if (!FAMILY_WATCHDOG_API_KEY) {
    console.warn("[location-insights] Family Watchdog API key not configured");
    return null;
  }

  try {
    // Family Watchdog API accepts address search with radius
    // Format: https://www.familywatchdog.us/api/search?key=API_KEY&address=ADDRESS&radius=RADIUS
    // Or lat/lon: https://www.familywatchdog.us/api/search?key=API_KEY&lat=LAT&lon=LON&radius=RADIUS
    // We'll use lat/lon for more accurate results
    const params = new URLSearchParams({
      key: FAMILY_WATCHDOG_API_KEY,
      lat: lat.toString(),
      lon: lon.toString(),
      radius: radiusMiles.toString(),
    });

    const url = `${FAMILY_WATCHDOG_API_URL}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Landlord Decoder",
      },
      next: { revalidate: CACHE_TTL.AUGMENT }, // Cache for 7 days
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(
        `[location-insights] Family Watchdog API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return null;
    }

    const data = await response.json() as FamilyWatchdogResponse;
    
    if (!data.success) {
      console.error(
        `[location-insights] Family Watchdog API error: ${data.error || "Unknown error"}`
      );
      return null;
    }

    return {
      count: data.count || 0,
      offenders: data.offenders,
    };
  } catch (error) {
    console.error("[location-insights] Error querying Family Watchdog API:", error);
    return null;
  }
}

/**
 * Get sex offender counts for multiple radii
 * Caches results in KV store
 */
async function getSexOffenderCounts(
  address: string,
  lat: number,
  lon: number
): Promise<{ count_1mi?: number; count_2mi?: number }> {
  if (!FAMILY_WATCHDOG_API_KEY) {
    return {};
  }

  const hash = addrHash(address);
  const version = "v1";

  // Cache key for 1 mile radius - use augment prefix since it's part of augmentation
  const cacheKey1mi = cacheKey(CACHE_PREFIXES.AUGMENT, `sex_offenders:${hash}:1mi`, version);
  const count1mi = await getOrSet(
    cacheKey1mi,
    CACHE_TTL.AUGMENT,
    async () => {
      const result = await queryFamilyWatchdogAPI(address, lat, lon, 1);
      return result?.count || 0;
    }
  );

  // Cache key for 2 mile radius
  const cacheKey2mi = cacheKey(CACHE_PREFIXES.AUGMENT, `sex_offenders:${hash}:2mi`, version);
  const count2mi = await getOrSet(
    cacheKey2mi,
    CACHE_TTL.AUGMENT,
    async () => {
      const result = await queryFamilyWatchdogAPI(address, lat, lon, 2);
      return result?.count || 0;
    }
  );

  return {
    count_1mi: count1mi > 0 ? count1mi : undefined,
    count_2mi: count2mi > 0 ? count2mi : undefined,
  };
}

/**
 * Get state abbreviation from full state name
 */
function getStateAbbreviation(state: string): string {
  const stateMap: Record<string, string> = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
  };

  // If already abbreviation, return as-is
  if (state.length === 2) {
    return state.toUpperCase();
  }

  return stateMap[state] || state.toUpperCase().slice(0, 2);
}

/**
 * Get sex offender registry links for a state
 */
function getSexOffenderRegistryLinks(state: string): Array<{
  state: string;
  url: string;
  name: string;
}> {
  const stateAbbr = getStateAbbreviation(state);
  
  // Common registry URLs by state
  const registryUrls: Record<string, string> = {
    CA: "https://www.meganslaw.ca.gov/",
    NY: "https://www.criminaljustice.ny.gov/nsor/",
    TX: "https://www.dps.texas.gov/section/sex-offender-registry",
    FL: "https://www.fdle.state.fl.us/sexual-offenders-and-predators.aspx",
    IL: "https://www.isp.state.il.us/sor/",
    PA: "https://www.pameganslaw.state.pa.us/",
    OH: "https://www.ohioattorneygeneral.gov/Law-Enforcement/Sex-Offender-Database",
    GA: "https://gbi.georgia.gov/divisions/georgia-bureau-investigation/sex-offender-registry",
    NC: "https://www.ncsbi.gov/Fraud/Sex-Offender-Registry",
    MI: "https://www.michigan.gov/msp/divisions/technical-services/cjis/sex-offender-registry",
    NJ: "https://www.njsp.org/sex-offender-registry/",
    VA: "https://www.vsp.virginia.gov/sex_offender_registry.shtm",
    WA: "https://www.dshs.wa.gov/sesa/sex-offender-registry",
    AZ: "https://www.azdps.gov/services/sex-offender-info",
    MA: "https://www.mass.gov/info-details/sex-offender-registry-board",
    TN: "https://www.tbi.tn.gov/sex-offender-registry",
    IN: "https://www.in.gov/isp/sex-offender-registry/",
    MO: "https://www.mshp.dps.missouri.gov/MSHPWeb/PatrolDivisions/CRID/SOR/SORPage.html",
    MD: "https://www.dpscs.state.md.us/onlineservs/sor/",
    WI: "https://apps.wi.gov/Documents/ViewPublic.do",
    CO: "https://www.colorado.gov/pacific/cbi/sex-offender-registry",
    MN: "https://pa.courts.state.mn.us/default.aspx",
    SC: "https://www.sled.sc.gov/sor/",
    AL: "https://www.dps.alabama.gov/Home/Welcome",
    LA: "https://www.dps.louisiana.gov/sor/",
    KY: "https://kspsor.ky.gov/",
    OR: "https://www.oregon.gov/osp/pages/sex-offender-registry.aspx",
    OK: "https://www.ok.gov/osbi/Sex_Offender_Registry/",
    CT: "https://www.ct.gov/dps/cwp/view.asp?a=4101&q=477820",
    UT: "https://bci.utah.gov/sex-offender-registry/",
    IA: "https://www.iowasexoffender.gov/",
    AR: "https://www.ark.org/asp/criminal/offender_search.php",
    NV: "https://www.nv.gov/sos/SexOffender/",
    MS: "https://www.dps.ms.gov/divisions/administration/sex-offender-registry",
    KS: "https://www.kbi.ks.gov/registeredoffender/home",
    NM: "https://www.nmsexoffender.dps.state.nm.us/",
    NE: "https://www.nebraska.gov/sor/",
    WV: "https://www.wvstatepolice.com/sex-offender-registry/",
    ID: "https://www.isp.idaho.gov/sor/",
    HI: "https://www.crimetip.com/sex-offender-registry/",
    NH: "https://www.doj.nh.gov/criminal/sex-offenders/",
    ME: "https://www.maine.gov/dps/msp/sex-offender-registry/",
    MT: "https://app.dojmt.gov/sor/",
    RI: "https://www.paroleboard.ri.gov/sex-offender-registry/",
    DE: "https://sexoffender.delaware.gov/",
    SD: "https://sors.sd.gov/",
    ND: "https://www.sexoffender.nd.gov/",
    AK: "https://www.dps.alaska.gov/Statewide/ASOR",
    VT: "https://vcic.vermont.gov/sex-offender-registry",
    WY: "https://www.wyoming.gov/forms/sex-offender-registry",
    DC: "https://mpdc.dc.gov/service/sex-offender-registry",
  };

  const url = registryUrls[stateAbbr];
  if (url) {
    return [
      {
        state: stateAbbr,
        url,
        name: `${stateAbbr} Sex Offender Registry`,
      },
    ];
  }

  // Fallback: provide a generic search link
  return [
    {
      state: stateAbbr,
      url: `https://www.google.com/search?q=${encodeURIComponent(state + " sex offender registry")}`,
      name: `${stateAbbr} Sex Offender Registry (Search)`,
    },
  ];
}

/**
 * Query Google Places API for nearby places
 */
async function queryGooglePlaces(
  lat: number,
  lon: number,
  type: string,
  radiusMeters: number = 1600 // ~1 mile
): Promise<number> {
  if (!GOOGLE_MAPS_API_KEY) {
    return 0;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radiusMeters}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.results?.length || 0;
  } catch (error) {
    console.error(`[location-insights] Error querying Google Places for ${type}:`, error);
    return 0;
  }
}

/**
 * Get nearby schools using Google Places API
 */
async function getNearbySchools(
  lat: number,
  lon: number
): Promise<AugmentJSON["location_insights"]["schools"]> {
  if (!GOOGLE_MAPS_API_KEY) {
    return undefined;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=2000&type=school&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return undefined;
    }

    // Get place details for ratings (requires additional API call)
    // For MVP, just return basic school info
    const schools = data.results.slice(0, 5).map((place: any) => {
      // Calculate distance (rough estimate)
      const distanceKm = Math.sqrt(
        Math.pow((place.geometry.location.lat - lat) * 111, 2) +
        Math.pow((place.geometry.location.lng - lon) * 111 * Math.cos(lat * Math.PI / 180), 2)
      );
      const distanceM = Math.round(distanceKm * 1000);

      return {
        name: place.name,
        distance_m: distanceM,
        rating: place.rating,
        type: place.types?.includes("elementary_school")
          ? "elementary"
          : place.types?.includes("secondary_school")
          ? "high"
          : "other",
      };
    });

    return schools;
  } catch (error) {
    console.error("[location-insights] Error getting nearby schools:", error);
    return undefined;
  }
}

/**
 * Get transit stations nearby
 */
async function getTransitStations(
  lat: number,
  lon: number
): Promise<number> {
  if (!GOOGLE_MAPS_API_KEY) {
    return 0;
  }

  try {
    // Query for transit stations
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=1600&type=transit_station&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.results?.length || 0;
  } catch (error) {
    console.error("[location-insights] Error getting transit stations:", error);
    return 0;
  }
}

/**
 * Compute location insights for a property
 */
export async function computeLocationInsights(
  lat: number,
  lon: number,
  state: string,
  address: string
): Promise<AugmentJSON["location_insights"]> {
  const insights: AugmentJSON["location_insights"] = {};

  // Sex offender registry links
  const registryLinks = getSexOffenderRegistryLinks(state);
  
  // Get sex offender counts from Family Watchdog API (cached in KV)
  const offenderCounts = await getSexOffenderCounts(address, lat, lon);
  
  insights.sex_offenders = {
    ...offenderCounts,
    registry_links: registryLinks,
    note: "Data from Family Watchdog API. Check official state registries for current information. This data is public record and may change.",
  };

  // Nearby amenities using Google Places API
  if (GOOGLE_MAPS_API_KEY) {
    const [groceryCount, restaurantCount, parkCount, schoolCount, transitCount] =
      await Promise.all([
        queryGooglePlaces(lat, lon, "grocery_or_supermarket", 1600),
        queryGooglePlaces(lat, lon, "restaurant", 1600),
        queryGooglePlaces(lat, lon, "park", 1600),
        queryGooglePlaces(lat, lon, "school", 1600),
        getTransitStations(lat, lon),
      ]);

    insights.nearby_amenities = {
      grocery_stores: groceryCount,
      restaurants: restaurantCount,
      parks: parkCount,
      schools: schoolCount,
      transit_stations: transitCount,
    };

    // Get detailed school info
    const schools = await getNearbySchools(lat, lon);
    if (schools) {
      insights.schools = schools;
    }

    insights.transit = {
      stations_nearby: transitCount,
    };
  }

  return insights;
}

