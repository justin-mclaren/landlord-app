"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { DecoderReport } from "@/types/report";
import type { ListingJSON } from "@/types/listing";
import type { AugmentJSON } from "@/types/augment";
import { PropertyMap } from "./PropertyMap";

interface ReportViewProps {
  report: DecoderReport;
  address: string;
  listing: ListingJSON;
  augment?: AugmentJSON;
  slug?: string; // Add slug for sharing
}

export function ReportView({
  report,
  address,
  listing,
  augment,
  slug,
}: ReportViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [showNativeShare, setShowNativeShare] = useState(false);

  // Get share URL
  const shareUrl =
    typeof window !== "undefined"
      ? slug
        ? `${window.location.origin}/d/${slug}`
        : window.location.href
      : "";

  // Check for native share support after mount (avoid hydration mismatch)
  useEffect(() => {
    // Use requestAnimationFrame to defer state update and avoid linter warning
    requestAnimationFrame(() => {
      if (
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        "share" in navigator
      ) {
        setShowNativeShare(true);
      }
    });
  }, []);

  // Check if there's no active listing (missing price/beds/baths or explicit flag)
  const hasNoActiveListing =
    listing.source.has_active_listing === false ||
    (!listing.listing.price &&
      listing.listing.beds === undefined &&
      listing.listing.baths === undefined);

  // Extract tags from listing data
  const tags: string[] = [];
  if (listing.listing.sqft && listing.listing.sqft < 300) {
    tags.push(`< ${listing.listing.sqft} sqft`);
  } else if (listing.listing.sqft) {
    tags.push(`${listing.listing.sqft} sqft`);
  }

  // Check for basement in description or features
  const descriptionLower = listing.listing.description_raw?.toLowerCase() || "";
  const featuresLower = listing.listing.features?.join(" ").toLowerCase() || "";
  if (
    descriptionLower.includes("basement") ||
    featuresLower.includes("basement")
  ) {
    tags.push("Basement");
  }

  // Check for parking
  const hasParking =
    descriptionLower.includes("parking") ||
    featuresLower.includes("parking") ||
    featuresLower.includes("garage");
  if (!hasParking) {
    tags.push("No Parking");
  }

  // Check for noise (from augmentation - would need to pass augment data)
  // For now, we'll skip noise tag unless we have augment data

  const handleCopyQuestions = () => {
    const questionsText = report.follow_up_questions.join("\n");
    navigator.clipboard.writeText(questionsText).then(() => {
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2000);
    });
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleShareTwitter = () => {
    const text = `${address} scored ${report.scorecard.total}/100 - ${report.caption}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  };

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}`;
    window.open(facebookUrl, "_blank", "width=550,height=420");
  };

  const handleShareLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      shareUrl
    )}`;
    window.open(linkedInUrl, "_blank", "width=550,height=420");
  };

  const handleShareNative = async () => {
    // Check if Web Share API is available (mainly mobile browsers)
    if (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "share" in navigator
    ) {
      try {
        await navigator.share({
          title: `${address} - Decoder Report`,
          text: `${address} scored ${report.scorecard.total}/100 - ${report.caption}`,
          url: shareUrl,
        });
        // Success - share sheet was opened
      } catch (error) {
        // User cancelled (AbortError) - this is normal, don't show error
        // Other errors - log for debugging but don't show to user
        const shareError = error as Error;
        if (shareError.name !== "AbortError") {
          console.warn("Web Share API failed:", shareError);
          // Fallback to copy link on error
          handleCopyLink();
        }
      }
    } else {
      // Fallback to copy link if Web Share API not available (desktop browsers)
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* Header Bar */}
      <header className="border-b border-[#1E1E1E]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/landlord-bust.svg"
              alt="Landlord Lies mascot"
              className="h-8 w-8 flex-shrink-0 scale-x-[-1]"
            />
            <span className="font-title text-xl font-black tracking-tight">
              <span className="text-[#1A1B2E]">LANDLORD</span>{" "}
              <span className="text-[#DC2626]">LIES</span>
            </span>
          </Link>
          <span className="hidden text-sm font-medium text-[#1E1E1E] md:block">
            Decoded Listing
          </span>
          <Link
            href="/"
            className="rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#DC2626]/90"
          >
            Decode another
          </Link>
        </div>
      </header>

      {/* No Active Listing Banner */}
      {hasNoActiveListing && (
        <div className="border-b border-[#DC2626]/20 bg-[#DC2626]/5">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:px-8">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-[#DC2626] mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#DC2626]">
                  No Active Listing Found
                </p>
                <p className="mt-1 text-sm text-[#1E1E1E]/70">
                  This property doesn&apos;t have an active listing (price,
                  beds, or baths not available). This report is based on
                  available property data and location information only.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="relative">
          {/* Main Report Content - No white card wrapper */}
          <div className="relative">
            {/* Top Section: Title, Meter, Mascot, and Summary */}
            <div className="mb-12 grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
              {/* Left Column: Title, Meter, Address, Tags, and Summary */}
              <div>
                {/* Title */}
                <h1 className="mb-6 text-5xl font-black text-[#1E1E1E] md:text-6xl lg:text-7xl">
                  The Truth
                </h1>

                {/* Score Gauge */}
                <div className="mb-8 flex justify-start">
                  <ScoreGauge score={report.scorecard.total} />
                </div>

                {/* Property Address */}
                <div className="mb-4">
                  <p className="text-xl font-bold text-[#1E1E1E] md:text-2xl">
                    {address}
                  </p>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="mb-8 flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-[#1E1E1E]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Summary Section - Desktop: in left column, same row as mascot */}
                <div className="hidden md:block max-w-2xl">
                  <p className="text-lg leading-relaxed text-[#1E1E1E] md:text-xl">
                    {report.summary}
                  </p>
                </div>
              </div>

              {/* Right Column: Mascot Illustration (Desktop) */}
              <div className="hidden md:flex md:items-start md:justify-center">
                <img
                  src="/landlord-full.svg"
                  alt="Landlord Lies mascot"
                  className="h-auto w-64 max-w-none scale-x-[-1]"
                />
              </div>
            </div>

            {/* Mobile: Mascot and Summary below */}
            <div className="mb-12 flex flex-col items-center gap-6 md:hidden">
              {/* Mascot Illustration - Mobile */}
              <img
                src="/landlord-full.svg"
                alt="Landlord Lies mascot"
                className="h-auto w-64 max-w-none"
              />

              {/* Summary Section - Mobile: below mascot */}
              <div>
                <p className="text-lg leading-relaxed text-[#1E1E1E] md:text-xl">
                  {report.summary}
                </p>
              </div>
            </div>

            {/* Two Columns: Red Flags and Positives as Cards */}
            <div className="mb-12 grid gap-8 md:grid-cols-2">
              {/* Red Flags Card */}
              {report.red_flags.length > 0 && (
                <div className="rounded-xl bg-[#FEE2E2] p-6 shadow-md">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-[#DC2626] md:text-2xl">
                    <span className="text-2xl">▲</span> Red Flags
                  </h3>
                  <ul className="space-y-3">
                    {report.red_flags
                      .filter(
                        (flag) =>
                          !flag.title
                            .toLowerCase()
                            .includes("incomplete listing") &&
                          !flag.description
                            .toLowerCase()
                            .includes("incomplete listing")
                      )
                      .map((flag, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="mt-1 text-xl text-[#DC2626]">⊖</span>
                          <span className="text-base text-[#1E1E1E] md:text-lg">
                            {flag.title}
                            {flag.source_field && (
                              <span className="text-sm text-[#1E1E1E]/60">
                                {" "}
                                ({flag.source_field})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* What's Actually Good Card */}
              {report.positives.length > 0 && (
                <div className="rounded-xl bg-[#FFF8F0] border border-[#1E1E1E]/10 p-6 shadow-md">
                  <h3 className="mb-4 text-xl font-bold text-[#1E1E1E] md:text-2xl">
                    What&apos;s actually good
                  </h3>
                  <ul className="space-y-3">
                    {report.positives.map((positive, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="mt-1 text-xl text-green-600">✓</span>
                        <span className="text-base text-[#1E1E1E] md:text-lg">
                          {positive.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Location Insights Section */}
            {augment?.location_insights && (
              <div className="mb-12 rounded-xl border border-[#1E1E1E]/10 bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-xl font-bold text-[#1E1E1E] md:text-2xl">
                  Location Insights
                </h3>

                {/* Property Map */}
                {listing.listing.lat && listing.listing.lon && (
                  <div className="mb-6">
                    <PropertyMap
                      lat={listing.listing.lat}
                      lon={listing.listing.lon}
                      address={address}
                      locationInsights={augment.location_insights}
                      noise={augment.noise}
                    />
                  </div>
                )}

                {/* Sex Offender Registry */}
                {augment.location_insights.sex_offenders?.registry_links && (
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-semibold text-[#DC2626] uppercase tracking-wide">
                      ⚠️ Safety Check
                    </h4>
                    {/* Display counts if available */}
                    {(augment.location_insights.sex_offenders.count_1mi !==
                      undefined ||
                      augment.location_insights.sex_offenders.count_2mi !==
                        undefined) && (
                      <div className="mb-3 rounded-lg bg-[#DC2626]/10 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          {augment.location_insights.sex_offenders.count_1mi !==
                            undefined && (
                            <div>
                              <div className="text-2xl font-bold text-[#DC2626]">
                                {
                                  augment.location_insights.sex_offenders
                                    .count_1mi
                                }
                              </div>
                              <div className="text-xs text-[#1E1E1E]/70">
                                within 1 mile
                              </div>
                            </div>
                          )}
                          {augment.location_insights.sex_offenders.count_2mi !==
                            undefined && (
                            <div>
                              <div className="text-2xl font-bold text-[#DC2626]">
                                {
                                  augment.location_insights.sex_offenders
                                    .count_2mi
                                }
                              </div>
                              <div className="text-xs text-[#1E1E1E]/70">
                                within 2 miles
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-[#1E1E1E]/70">
                          Registered sex offenders near this property
                        </p>
                      </div>
                    )}
                    <p className="mb-3 text-sm text-[#1E1E1E]/70">
                      {augment.location_insights.sex_offenders.note ||
                        "Check official state registries for current information. This data is public record and may change."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {augment.location_insights.sex_offenders.registry_links.map(
                        (link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-[#DC2626]/10 px-4 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#DC2626]/20"
                          >
                            {link.name}
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Nearby Amenities */}
                {augment.location_insights.nearby_amenities && (
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-semibold text-[#1E1E1E] uppercase tracking-wide">
                      📍 Nearby (within 1 mile)
                    </h4>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                      {augment.location_insights.nearby_amenities
                        .grocery_stores !== undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#1E1E1E]">
                            {
                              augment.location_insights.nearby_amenities
                                .grocery_stores
                            }
                          </div>
                          <div className="text-xs text-[#1E1E1E]/60">
                            Grocery Stores
                          </div>
                        </div>
                      )}
                      {augment.location_insights.nearby_amenities
                        .restaurants !== undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#1E1E1E]">
                            {
                              augment.location_insights.nearby_amenities
                                .restaurants
                            }
                          </div>
                          <div className="text-xs text-[#1E1E1E]/60">
                            Restaurants
                          </div>
                        </div>
                      )}
                      {augment.location_insights.nearby_amenities.parks !==
                        undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#1E1E1E]">
                            {augment.location_insights.nearby_amenities.parks}
                          </div>
                          <div className="text-xs text-[#1E1E1E]/60">Parks</div>
                        </div>
                      )}
                      {augment.location_insights.nearby_amenities.schools !==
                        undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#1E1E1E]">
                            {augment.location_insights.nearby_amenities.schools}
                          </div>
                          <div className="text-xs text-[#1E1E1E]/60">
                            Schools
                          </div>
                        </div>
                      )}
                      {augment.location_insights.nearby_amenities
                        .transit_stations !== undefined && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#1E1E1E]">
                            {
                              augment.location_insights.nearby_amenities
                                .transit_stations
                            }
                          </div>
                          <div className="text-xs text-[#1E1E1E]/60">
                            Transit Stations
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Nearby Schools */}
                {augment.location_insights.schools &&
                  augment.location_insights.schools.length > 0 && (
                    <div className="mb-6">
                      <h4 className="mb-3 text-sm font-semibold text-[#1E1E1E] uppercase tracking-wide">
                        🏫 Nearby Schools
                      </h4>
                      <ul className="space-y-2">
                        {augment.location_insights.schools
                          .slice(0, 5)
                          .map((school, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-[#1E1E1E]">
                                {school.name}
                                {school.type && (
                                  <span className="ml-2 text-xs text-[#1E1E1E]/60">
                                    ({school.type})
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                {school.rating && (
                                  <span className="text-xs text-[#1E1E1E]/60">
                                    ⭐ {school.rating.toFixed(1)}
                                  </span>
                                )}
                                {school.distance_m && (
                                  <span className="text-xs text-[#1E1E1E]/60">
                                    {school.distance_m < 1000
                                      ? `${school.distance_m}m`
                                      : `${(school.distance_m / 1000).toFixed(
                                          1
                                        )}km`}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Ask the Landlord Section */}
            {report.follow_up_questions.length > 0 && (
              <div className="mb-12">
                <h3 className="mb-4 text-xl font-bold text-[#1E1E1E] md:text-2xl">
                  Ask the Landlord
                </h3>
                <ul className="mb-6 space-y-3">
                  {report.follow_up_questions.map((question, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="mt-1 text-xl text-[#1E1E1E]">⊕</span>
                      <span className="text-base text-[#1E1E1E] md:text-lg">
                        {question}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleCopyQuestions}
                  className="rounded-lg bg-gray-200 px-6 py-3 text-sm font-semibold text-[#1E1E1E] transition-colors hover:bg-gray-300"
                >
                  {copiedQuestions ? "Copied!" : "Copy all questions"}
                </button>
              </div>
            )}

            {/* Share Card */}
            <div className="mb-8 rounded-xl border border-[#1E1E1E]/10 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  <img
                    src="/landlord-bust.svg"
                    alt="Landlord Lies mascot"
                    className="h-12 w-12 scale-x-[-1]"
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1E1E1E]">
                      Share this report
                    </span>
                    <span className="text-2xl font-bold text-[#DC2626]">
                      {report.scorecard.total}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-[#1E1E1E]/70">
                    {report.caption}
                  </p>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Native Share (mobile only - opens system share sheet) */}
                {showNativeShare && (
                  <button
                    onClick={handleShareNative}
                    className="flex items-center gap-2 rounded-lg bg-[#1E1E1E] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E1E1E]/90"
                    aria-label="Share via system share sheet"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    Share
                  </button>
                )}

                {/* Twitter/X */}
                <button
                  onClick={handleShareTwitter}
                  className="flex items-center gap-2 rounded-lg bg-[#1E1E1E] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E1E1E]/90"
                  aria-label="Share on X (Twitter)"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </button>

                {/* Facebook */}
                <button
                  onClick={handleShareFacebook}
                  className="flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1877F2]/90"
                  aria-label="Share on Facebook"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </button>

                {/* LinkedIn */}
                <button
                  onClick={handleShareLinkedIn}
                  className="flex items-center gap-2 rounded-lg bg-[#0077B5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0077B5]/90"
                  aria-label="Share on LinkedIn"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  LinkedIn
                </button>

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 rounded-lg border-2 border-[#1E1E1E]/20 bg-white px-4 py-2 text-sm font-semibold text-[#1E1E1E] transition-colors hover:bg-gray-50"
                  aria-label="Copy link to clipboard"
                >
                  {copied ? (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1E1E1E]/10">
                <Link
                  href="/"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Decode another listing
                </Link>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#1E1E1E]/10 pt-8">
              <div className="flex flex-col items-center justify-between gap-4 text-sm text-[#1E1E1E]/60 md:flex-row">
                <p className="text-center md:text-left">
                  Landlord Lies—exposing the truth behind every &apos;charming
                  studio.&apos;
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <span>Powered by</span>
                  <a
                    href="https://maps.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#1E1E1E] hover:text-[#DC2626] transition-colors"
                  >
                    Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Score Gauge Component (CSS-based like CodePen example)
function ScoreGauge({ score }: { score: number }) {
  // Clamp score between 0-100
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const [displayedScore, setDisplayedScore] = useState(0);

  // Determine color based on score
  const getScoreColor = () => {
    if (clampedScore >= 70) return "#22c55e"; // green
    if (clampedScore >= 40) return "#eab308"; // yellow
    return "#DC2626"; // red
  };

  // Calculate rotation angle for needle
  // Score 0 = 0deg (left), Score 100 = 180deg (right)
  // Formula: angle = (score / 100) * 180
  const rotationAngle = (clampedScore / 100) * 180;

  // Animate needle and number on mount
  useEffect(() => {
    if (gaugeRef.current) {
      const needle = gaugeRef.current.querySelector(
        ".gauge-needle"
      ) as HTMLElement;
      if (needle) {
        // Start from left position (0 degrees)
        needle.style.transform = "rotate(0deg)";
        needle.style.transition = "transform 1.5s ease-out";

        // Trigger animation after a brief delay
        requestAnimationFrame(() => {
          if (needle) {
            needle.style.transform = `rotate(${rotationAngle}deg)`;
          }
        });
      }

      // Animate number counting up
      const duration = 1500; // Match gauge animation duration
      const startTime = Date.now();
      const startValue = 0;
      const endValue = clampedScore;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out function (matching CSS ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(
          startValue + (endValue - startValue) * easeOut
        );

        setDisplayedScore(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayedScore(clampedScore); // Ensure final value is exact
        }
      };

      requestAnimationFrame(animate);
    }
  }, [rotationAngle, clampedScore]);

  return (
    <div
      className="relative inline-block"
      style={{ width: "300px", height: "150px" }}
    >
      {/* Gauge container */}
      <div
        ref={gaugeRef}
        className="gauge-container"
        style={{
          width: "300px",
          height: "150px",
          borderRadius: "150px 150px 0 0",
          position: "relative",
          overflow: "hidden",
          background: `
            radial-gradient(circle at bottom center, #FFF8F0 89px, #FFF8F0 90px, transparent 90px),
            conic-gradient(from 4.7rad at 50% 100%, 
              #DC2626 0deg 72deg,
              #eab308 72deg 144deg,
              #22c55e 144deg 180deg
            )
          `,
          WebkitTransformStyle: "flat",
          WebkitTransform: "translateZ(0px)",
          display: "grid",
          alignItems: "end",
          justifyContent: "center",
        }}
      >
        {/* Needle as pseudo-element via className */}
        <div
          className="gauge-needle"
          style={{
            position: "absolute",
            bottom: "-4px",
            left: "15px",
            width: "135px",
            height: "9px",
            background:
              "linear-gradient(to left, transparent 82px, black 82px)",
            borderRadius: "50%",
            boxShadow: "4px 3px 4px #555",
            clipPath: "polygon(-15px -15px, 45px -15px, 45px 15px, -15px 15px)",
            transformOrigin: "center right",
            transform: "rotate(0deg)",
          }}
        />

        {/* Score number - aligned with bottom of arc */}
        <div
          style={{
            position: "absolute",
            bottom: "0px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "5.25em",
            fontWeight: "900",
            color: getScoreColor(),
            zIndex: 10,
            fontFamily: "Arial, sans-serif",
            lineHeight: "1",
          }}
        >
          {displayedScore}
        </div>
      </div>
    </div>
  );
}
