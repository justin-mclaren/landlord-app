/**
 * Augmentation data for a property
 * Contains computed heuristics (noise, hazards, commute)
 */
export type AugmentJSON = {
  geocode?: {
    lat: number;
    lon: number;
    provider: "nominatim" | "mapbox" | "listing";
  };
  noise?: {
    level: "high" | "medium" | "low";
    motorway_distance_m?: number;
    airport_distance_m?: number;
  };
  hazards?: {
    flood?: "high" | "medium" | "low" | "unknown";
    wildfire?: "high" | "medium" | "low" | "unknown";
    source?: string;
  };
  commute?: {
    work_address?: string;
    driving_time_min?: number;
    driving_time_range?: [number, number]; // [min, max] in minutes
    provider?: "google" | "mapbox" | "estimate";
  };
  location_insights?: {
    sex_offenders?: {
      count_1mi?: number;
      count_2mi?: number;
      registry_links?: Array<{
        state: string;
        url: string;
        name: string;
      }>;
      note?: string; // Legal disclaimer
    };
    nearby_amenities?: {
      grocery_stores?: number;
      restaurants?: number;
      parks?: number;
      schools?: number;
      transit_stations?: number;
    };
    schools?: Array<{
      name: string;
      distance_m?: number;
      rating?: number;
      type?: "elementary" | "middle" | "high" | "other";
    }>;
    transit?: {
      stations_nearby?: number;
      walk_score?: number; // If available from API
    };
  };
  computed_at: string;
  version?: string; // Schema version for cache busting
};

