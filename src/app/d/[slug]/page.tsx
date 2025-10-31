/**
 * Report page route
 * GET /d/[id]
 * Displays the decoder report for a property
 * Uses unique IDs instead of slugs for security (non-guessable URLs)
 */
import { ReportView } from "@/components/ReportView";
import { getReportMapping } from "@/lib/storage";
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
  const mapping = await getReportMapping(slug);

  if (!mapping) {
    return {
      title: "Report Not Found",
      description: "Property report not found",
    };
  }

  const { listing, report } = mapping;
  const address = `${listing.listing.address}, ${listing.listing.city}, ${listing.listing.state}`;
  
  // Get base URL for absolute URLs in metadata
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  
  const reportUrl = `${baseUrl}/d/${slug}`;
  const ogImageUrl = `${baseUrl}/og/${slug}.png`;

  // Build share text for Twitter/X
  const shareText = `${address} scored ${report.scorecard.total}/100 - ${report.caption}`;

  return {
    title: `${address} - Decoder Report | Score: ${report.scorecard.total}/100`,
    description: report.caption,
    keywords: ["rental listing", "property decoder", "landlord decoder", address, listing.listing.city, listing.listing.state],
    authors: [{ name: "Landlord Lies" }],
    creator: "Landlord Lies",
    publisher: "Landlord Lies",
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: reportUrl,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: reportUrl,
      siteName: "Landlord Lies",
      title: `${address} - Score: ${report.scorecard.total}/100`,
      description: report.caption,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Property decoder report for ${address} showing score of ${report.scorecard.total}/100`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${address} - Score: ${report.scorecard.total}/100`,
      description: report.caption,
      images: [ogImageUrl],
      creator: "@landlordlies", // Update with actual Twitter handle if available
      site: "@landlordlies",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const mapping = await getReportMapping(slug);

  if (!mapping) {
    notFound();
  }

  const { listing, report, augment } = mapping;
  const address = `${listing.listing.address}, ${listing.listing.city}, ${listing.listing.state}`;

  return <ReportView report={report} address={address} listing={listing} augment={augment} slug={slug} />;
}
