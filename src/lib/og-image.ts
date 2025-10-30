/**
 * OG Image generation using Satori
 * Generates shareable Open Graph images for reports
 */
import satori from "satori";
import type { DecoderReport } from "@/types/report";
import type { ListingJSON } from "@/types/listing";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "./cache";
import { addrHash, prefsHash, reportHash } from "./hash";

const DECODER_CONFIG_VERSION = "v1";

/**
 * Load font for Satori rendering
 * Loads Inter font as TTF (Satori requires TTF/OTF, not WOFF2)
 * For MVP, we'll use a CDN-hosted TTF font
 */
async function loadFont(): Promise<ArrayBuffer> {
  try {
    // Try multiple font sources for reliability
    const fontUrls = [
      "https://cdn.jsdelivr.net/npm/inter-ui@3.19.0/font-files/Inter-Regular.ttf",
      "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.ttf",
      "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf",
    ];

    for (const fontUrl of fontUrls) {
      try {
        const response = await fetch(fontUrl);
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch (e) {
        // Try next URL
        continue;
      }
    }

    throw new Error("All font URLs failed");
  } catch (error) {
    console.error("Failed to load font:", error);
    // For production, bundle the font file in the project
    throw new Error(
      "Font loading failed - Satori requires at least one TTF/OTF font. Consider bundling a font file."
    );
  }
}

/**
 * Generate OG image SVG using Satori
 */
async function generateOGImageSVG(
  listing: ListingJSON,
  report: DecoderReport
): Promise<string> {
  const { listing: l } = listing;
  const address = `${l.address}, ${l.city}, ${l.state}`;
  const score = report.scorecard.total;

  // Get top 2 red flags
  const topRedFlags = report.red_flags.slice(0, 2);
  const topPositive = report.positives[0];

  // Load font for Satori
  const fontData = await loadFont();

  // Satori accepts VNode-like structures, TypeScript types are strict
  // @ts-ignore - Satori accepts this structure at runtime
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "1200",
          height: "630",
          backgroundColor: "#ffffff",
          padding: "60px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        },
        children: [
          // Score display
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "40px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "120px",
                      fontWeight: "bold",
                      color:
                        score >= 70
                          ? "#059669"
                          : score >= 50
                          ? "#f59e0b"
                          : "#dc2626",
                      lineHeight: "1",
                    },
                    children: score.toString(),
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "32px",
                      color: "#374151",
                      marginTop: "10px",
                    },
                    children: "Overall Score",
                  },
                },
              ],
            },
          },
          // Address and caption
          {
            type: "div",
            props: {
              style: {
                fontSize: "36px",
                fontWeight: "600",
                color: "#111827",
                marginBottom: "10px",
                textAlign: "center",
              },
              children: address,
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: "24px",
                color: "#6b7280",
                marginBottom: "40px",
                textAlign: "center",
              },
              children: report.caption,
            },
          },
          // Red flags
          ...topRedFlags.map((flag, idx) => ({
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "flex-start",
                marginBottom: "20px",
                padding: "20px",
                backgroundColor: "#fef2f2",
                borderRadius: "8px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "20px",
                      marginRight: "10px",
                    },
                    children: "🚩",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      flex: 1,
                    },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "22px",
                            fontWeight: "600",
                            color: "#991b1b",
                            marginBottom: "5px",
                          },
                          children: flag.title,
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "18px",
                            color: "#7f1d1d",
                          },
                          children: flag.description.slice(0, 100) + "...",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          })),
          // Positive
          topPositive && {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "flex-start",
                marginTop: "20px",
                padding: "20px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "20px",
                      marginRight: "10px",
                    },
                    children: "✓",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      flex: 1,
                    },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "22px",
                            fontWeight: "600",
                            color: "#166534",
                            marginBottom: "5px",
                          },
                          children: topPositive.title,
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "18px",
                            color: "#14532d",
                          },
                          children:
                            topPositive.description.slice(0, 100) + "...",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ].filter(Boolean),
      },
    } as any,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
    }
  );

  return svg;
}

/**
 * Convert SVG to PNG
 * For MVP, we'll return SVG as-is and convert in the route handler
 * In production, use @resvg/resvg-js or similar
 */
async function svgToPng(svg: string): Promise<Buffer> {
  // For MVP, we'll handle PNG conversion in the route handler
  // This requires @resvg/resvg-js or puppeteer
  // For now, return SVG as Buffer (will need conversion)
  return Buffer.from(svg, "utf-8");
}

/**
 * Get or create OG image
 * Returns image data as Buffer (PNG format)
 */
export async function getOrCreateOGImage(
  listing: ListingJSON,
  report: DecoderReport,
  prefsHash: string = "default"
): Promise<Buffer> {
  const addr = addrHash(listing.listing.address);
  const hash = reportHash(addr, prefsHash, DECODER_CONFIG_VERSION);
  const version = DECODER_CONFIG_VERSION;

  return getOrSet(
    cacheKey(CACHE_PREFIXES.OG_IMAGE, hash, version),
    CACHE_TTL.OG_IMAGE,
    async () => {
      const svg = await generateOGImageSVG(listing, report);
      // For now, return SVG buffer - conversion to PNG happens in route
      return Buffer.from(svg, "utf-8");
    }
  );
}
