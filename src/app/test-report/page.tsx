/**
 * Test route with dummy data
 * GET /test-report
 * Shows the report page with sample data
 */
import { ReportView } from "@/components/ReportView";
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";

export default function TestReportPage() {
  // Dummy listing data
  const dummyListing: ListingJSON = {
    source: {
      url: "https://example.com/test-listing",
      fetched_at: new Date().toISOString(),
      provider: "rentcast",
      version: "v1",
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

  // Dummy report data
  const dummyReport: DecoderReport = {
    summary:
      "Despite the cheerful tone, this 'charming studio' is a small basement unit with no natural light and above-average noise. The listing uses euphemisms to mask significant drawbacks.",
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
    ],
    positives: [
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
        score: 7,
        rationale: "No major hazards detected",
      },
      transparency: {
        score: 5,
        rationale: "Listing uses euphemisms to mask drawbacks",
      },
      total: 50,
    },
    follow_up_questions: [
      "Is there dedicated parking or just street parking?",
      "How much natural light does the unit get?",
      "What is the noise level like during peak hours?",
      "Are there any windows in the unit?",
      "What utilities are included in the rent?",
      "Is the building pet-friendly?",
    ],
    caption:
      "A 'charming studio' that's actually a windowless basement with noise issues.",
    generated_at: new Date().toISOString(),
    version: "v1",
  };

  const address = `${dummyListing.listing.address}, ${dummyListing.listing.city}, ${dummyListing.listing.state}`;

  return (
    <ReportView report={dummyReport} address={address} listing={dummyListing} />
  );
}

