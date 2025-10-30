/**
 * Augmentation data for a property
 * Contains computed heuristics (noise, hazards, commute)
 */
export type AugmentJSON = {
  geocode?: {
    lat: number;
    lon: number;
    provider: "nominatim" | "mapbox";
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
    provider?: "google" | "mapbox";
  };
  computed_at: string;
  version?: string; // Schema version for cache busting
};

