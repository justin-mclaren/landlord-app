"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { DecoderReport } from "@/types/report";
import type { ListingJSON } from "@/types/listing";

interface ReportViewProps {
  report: DecoderReport;
  address: string;
  listing: ListingJSON;
}

export function ReportView({ report, address, listing }: ReportViewProps) {
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Check out this decoded listing: ${report.caption}`;

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
                    {report.red_flags.map((flag, index) => (
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
                  {copied ? "Copied!" : "Copy all questions"}
                </button>
              </div>
            )}

            {/* Share Card */}
            <div className="mb-8 rounded-xl border border-[#1E1E1E]/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
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
                      Share on X
                    </span>
                    <span className="text-2xl font-bold text-[#DC2626]">
                      {report.scorecard.total}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-[#1E1E1E]/70">
                    {report.caption}
                  </p>
                  <Link
                    href="/"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Decode another listing
                  </Link>
                </div>
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
