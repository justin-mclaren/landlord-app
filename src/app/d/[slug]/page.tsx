/**
 * Report page route
 * GET /d/[slug]
 * Displays the decoder report for a property
 */
import { ReportView } from "@/components/ReportView";
import { getSlugMapping } from "@/lib/storage";
import { notFound } from "next/navigation";

export const revalidate = 86400; // Revalidate every 24 hours
export const dynamic = "force-dynamic"; // Changed to dynamic to fetch from KV

/**
 * Set CDN cache headers for report pages
 * Allows long-term caching with stale-while-revalidate for better performance
 */
export async function headers() {
  return {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mapping = await getSlugMapping(slug);

  if (!mapping) {
    return {
      title: "Report Not Found",
      description: "Property report not found",
    };
  }

  const { listing, report } = mapping;
  const address = `${listing.listing.address}, ${listing.listing.city}, ${listing.listing.state}`;

  return {
    title: `${address} - Decoder Report`,
    description: report.caption,
    openGraph: {
      title: `${address} - Score: ${report.scorecard.total}`,
      description: report.caption,
      images: [`/og/${slug}.png`],
    },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const mapping = await getSlugMapping(slug);

  if (!mapping) {
    notFound();
  }

  const { listing, report } = mapping;
  const address = `${listing.listing.address}, ${listing.listing.city}, ${listing.listing.state}`;

  // No watermark in freemium model - all reports are the same
  return <ReportView report={report} address={address} />;
}
