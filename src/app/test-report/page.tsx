/**
 * Test route with dummy data
 * GET /test-report
 * Shows the report page with sample data
 */
import { ReportView } from "@/components/ReportView";
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";
import type { AugmentJSON } from "@/types/augment";

export default function TestReportPage() {
  // Dummy listing data
  const dummyListing: ListingJSON = {
    source: {
      url: "https://example.com/test-listing",
      fetched_at: new Date().toISOString(),
      provider: "rentcast",
      version: "v1",
      has_active_listing: true,
    },
    listing: {
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90001",
      lat: 34.0522,
      lon: -118.2437,
      price: 2500,
      price_currency: "USD",
      price_type: "rent",
      beds: 1,
      baths: 1,
      sqft: 280,
      year_built: 1950,
      features: ["Basement", "Pets Allowed", "Utilities Included"],
      description_raw:
        "Charming studio apartment in the heart of the city. Perfect for first-time renters! Cozy living space with modern amenities. Close to public transportation. Street parking available.",
    },
  };

  // Dummy augmentation data with Family Watchdog mock data
  const dummyAugment: AugmentJSON = {
    geocode: {
      lat: 34.0522,
      lon: -118.2437,
      provider: "listing",
    },
    noise: {
      level: "high",
      motorway_distance_m: 200,
      airport_distance_m: 8000,
    },
    hazards: {
      flood: "low",
      wildfire: "medium",
      source: "FEMA",
    },
    commute: {
      work_address: "1234 Work St, Los Angeles, CA",
      driving_time_min: 25,
      driving_time_range: [20, 35],
      provider: "estimate",
    },
    location_insights: {
      sex_offenders: {
        count_1mi: 12,
        count_2mi: 25,
        registry_links: [
          {
            state: "CA",
            url: "https://www.meganslaw.ca.gov/",
            name: "CA Sex Offender Registry",
          },
        ],
        note: "Data from Family Watchdog API. Check official state registries for current information. This data is public record and may change.",
      },
      nearby_amenities: {
        grocery_stores: 4,
        restaurants: 12,
        parks: 2,
        schools: 3,
        transit_stations: 2,
      },
      schools: [
        {
          name: "Lincoln Elementary School",
          distance_m: 450,
          rating: 4.2,
          type: "elementary",
        },
        {
          name: "Washington Middle School",
          distance_m: 1200,
          rating: 3.8,
          type: "middle",
        },
        {
          name: "Roosevelt High School",
          distance_m: 1800,
          rating: 4.0,
          type: "high",
        },
      ],
      transit: {
        stations_nearby: 2,
      },
    },
    computed_at: new Date().toISOString(),
    version: "v1",
  };

  // Dummy report data (updated to include sex offender concerns)
  const dummyReport: DecoderReport = {
    summary:
      "Despite the cheerful tone, this 'charming studio' is a small basement unit with no natural light and above-average noise. The listing uses euphemisms to mask significant drawbacks. Safety concerns: 12 registered sex offenders within 1 mile.",
    red_flags: [
      {
        title: "No natural light",
        description: "Basement unit with no windows",
        source_field: "Description",
      },
      {
        title: "No dedicated parking",
        description: "Only street parking available",
        source_field: "Highlighted Section",
      },
      {
        title: "High noise levels",
        description: "Located near busy intersection",
        source_field: "Map",
      },
      {
        title: "Very small space",
        description: "Less than 300 square feet",
        source_field: "Sqft",
      },
      {
        title: "12 registered sex offenders within 1 mile",
        description: "Safety concern - check official registries for details",
      },
    ],
    positives: [
      {
        title: "Good nearby amenities",
        description: "4 grocery stores, 12 restaurants, and 2 parks within 1 mile",
      },
      {
        title: "Pets allowed",
        description: "Pet-friendly building",
      },
      {
        title: "Close to transit",
        description: "Walking distance to public transportation",
      },
      {
        title: "All utilities included",
        description: "No extra utility costs",
      },
    ],
    scorecard: {
      value: {
        score: 6,
        rationale: "Price is reasonable for the area but space is extremely limited",
      },
      livability: {
        score: 4,
        rationale: "Basement unit with no natural light significantly impacts livability",
      },
      noise_light: {
        score: 3,
        rationale: "High noise levels and no natural light",
      },
      hazards: {
        score: 4,
        rationale: "12 registered sex offenders within 1 mile is a significant safety concern",
      },
      transparency: {
        score: 5,
        rationale: "Listing uses euphemisms to mask drawbacks",
      },
      total: 44,
    },
    follow_up_questions: [
      "Were you aware of registered sex offenders in this area?",
      "Is there dedicated parking or just street parking?",
      "How much natural light does the unit get?",
      "What is the noise level like during peak hours?",
      "Are there any windows in the unit?",
      "What utilities are included in the rent?",
    ],
    caption:
      "A 'charming studio' with safety concerns: 12 registered sex offenders nearby.",
    generated_at: new Date().toISOString(),
    version: "v1",
  };

  const address = `${dummyListing.listing.address}, ${dummyListing.listing.city}, ${dummyListing.listing.state}`;

  return (
    <ReportView
      report={dummyReport}
      address={address}
      listing={dummyListing}
      augment={dummyAugment}
    />
  );
}

