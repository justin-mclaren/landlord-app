/**
 * Slug generation utility
 * Creates URL-friendly slugs from property addresses and reports
 */
import type { ListingJSON } from "@/types/listing";
import type { DecoderReport } from "@/types/report";

/**
 * Convert string to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate slug from property address
 */
export function generateSlugFromAddress(listing: ListingJSON): string {
  const { listing: l } = listing;
  
  // Build slug from: city-address
  const parts: string[] = [];
  
  if (l.city) {
    parts.push(slugify(l.city));
  }
  
  if (l.address) {
    // Extract street address (before comma if present)
    const streetAddress = l.address.split(",")[0].trim();
    parts.push(slugify(streetAddress));
  }
  
  // Fallback to full address if needed
  if (parts.length === 0) {
    parts.push(slugify(l.address || "property"));
  }
  
  return parts.join("-");
}

/**
 * Generate slug from property and report
 * Includes score for uniqueness/SEO
 */
export function generateSlugFromReport(
  listing: ListingJSON,
  report: DecoderReport
): string {
  const baseSlug = generateSlugFromAddress(listing);
  const score = report.scorecard.total;
  
  // Add score to slug: city-address-score
  return `${baseSlug}-${score}`;
}

/**
 * Generate a simple slug from address components
 */
export function generateSimpleSlug(address: string): string {
  return slugify(address);
}

