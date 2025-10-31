/**
 * AI Decoder module
 * Generates Decoder Reports using Vercel AI SDK
 */
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ListingJSON } from "@/types/listing";
import type { AugmentJSON } from "@/types/augment";
import type { DecoderReport } from "@/types/report";
import type { DecoderPrefs } from "@/types/workflow";
import { getOrSet, cacheKey, CACHE_PREFIXES, CACHE_TTL } from "./cache";
import { addrHash, prefsHash, reportHash } from "./hash";
import { APIError, ParseError, ConfigurationError } from "./errors";

const DECODER_MODEL = process.env.DECODER_MODEL ?? "gpt-4o-mini";
const DECODER_CONFIG_VERSION = "v1";

/**
 * Build the prompt for the AI decoder
 */
function buildPrompt(
  listing: ListingJSON,
  augment: AugmentJSON,
  prefs?: DecoderPrefs
): string {
  const payload = {
    listing: listing.listing,
    augmentation: augment,
    preferences: prefs,
  };

  return `You are Landlord Decoder. Be blunt but fair. Never invent facts.

Here is a normalized listing + augmentation + preferences:

<json>${JSON.stringify(payload, null, 2)}</json>

IMPORTANT: If price, beds, or baths are missing/undefined, note this in your analysis. 
You can still generate a report based on available data (location, features, year built, description, augmentation data).
When data is missing, explicitly state that in your rationale and adjust scores accordingly.

LOCATION INSIGHTS AVAILABLE:
- Sex offender registry: Check augmentation.location_insights.sex_offenders for:
  - count_1mi: Number of registered sex offenders within 1 mile
  - count_2mi: Number of registered sex offenders within 2 miles
  - registry_links: Official state registry URLs for verification
  IMPORTANT: Only add a red flag if count_1mi > 10. If you do add this red flag, place it LAST in the red_flags array. Do NOT include a source_field for sex offender red flags.
- Nearby amenities: Grocery stores, restaurants, parks, schools, transit (see augmentation.location_insights.nearby_amenities)
- Schools: Nearby schools with ratings (see augmentation.location_insights.schools)
- Transit: Public transportation access (see augmentation.location_insights.transit)

Task:
1) Write a 2-3 sentence reality summary that cuts through marketing speak. If listing data is incomplete, mention this upfront.
   - If sex offender counts are available (count_1mi > 10), mention this safety concern prominently
2) List up to 6 Red Flags (strongest first), citing which field triggers each. Be specific about what data supports each flag.
   - DO NOT add a red flag about missing price/beds/baths - this is handled by the UI banner.
   - Focus on actual property concerns based on available data (location, features, description, augmentation data).
   - If sex offender counts exist (count_1mi > 10), include a red flag like "X registered sex offenders within 1 mile - check official registries for details"
   - IMPORTANT: If you add a sex offender red flag, place it LAST in the red_flags array and do NOT include a source_field.
   - If location insights show safety concerns (e.g., no nearby amenities, poor transit access), include those as red flags
3) List up to 4 Positives. What genuinely stands out?
   - Highlight good location features: nearby amenities, schools, transit access, walkability
4) Scorecard: Rate each category (0-10) with short rationale:
   - Value: Price relative to area, sqft, amenities. If price is missing, score based on area/sqft/amenities only and note price unavailable.
   - Livability: Beds/baths, features, year built, overall quality. If beds/baths missing, score based on features/year/quality only and note missing data.
   - Noise/Light: Based on noise augmentation data, proximity to highways/airports
   - Hazards: Flood/wildfire risk from augmentation data. Also consider location safety factors including sex offender proximity if count_1mi > 10.
   - Transparency: Quality of listing description, completeness of data. If data is incomplete, score lower and note missing fields.
   Then calculate Total (0-100) as average of the 5 categories.
5) Provide 6 follow-up questions for landlord/agent that would clarify concerns or red flags. If data is missing, include questions to get that information.
   - If sex offender counts are present (count_1mi > 10), include a question like "Were you aware of registered sex offenders in this area?"
6) Write a 120-char one-liner caption that summarizes the property.

Return ONLY valid JSON in this exact structure:
{
  "summary": "string",
  "red_flags": [{"title": "string", "description": "string", "source_field": "string"}],
  "positives": [{"title": "string", "description": "string"}],
  "scorecard": {
    "value": {"score": number, "rationale": "string"},
    "livability": {"score": number, "rationale": "string"},
    "noise_light": {"score": number, "rationale": "string"},
    "hazards": {"score": number, "rationale": "string"},
    "transparency": {"score": number, "rationale": "string"},
    "total": number
  },
  "follow_up_questions": ["string"],
  "caption": "string"
}`;
}

/**
 * Parse AI response into DecoderReport
 */
function parseDecoderResponse(text: string): DecoderReport {
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate and normalize structure
    const report: DecoderReport = {
      summary: parsed.summary || "",
      red_flags: (parsed.red_flags || []).slice(0, 6).map((flag: any) => ({
        title: flag.title || "",
        description: flag.description || "",
        source_field: flag.source_field,
      })),
      positives: (parsed.positives || []).slice(0, 4).map((pos: any) => ({
        title: pos.title || "",
        description: pos.description || "",
      })),
      scorecard: {
        value: {
          score: Math.max(0, Math.min(10, parsed.scorecard?.value?.score || 0)),
          rationale: parsed.scorecard?.value?.rationale || "",
        },
        livability: {
          score: Math.max(0, Math.min(10, parsed.scorecard?.livability?.score || 0)),
          rationale: parsed.scorecard?.livability?.rationale || "",
        },
        noise_light: {
          score: Math.max(0, Math.min(10, parsed.scorecard?.noise_light?.score || 0)),
          rationale: parsed.scorecard?.noise_light?.rationale || "",
        },
        hazards: {
          score: Math.max(0, Math.min(10, parsed.scorecard?.hazards?.score || 0)),
          rationale: parsed.scorecard?.hazards?.rationale || "",
        },
        transparency: {
          score: Math.max(0, Math.min(10, parsed.scorecard?.transparency?.score || 0)),
          rationale: parsed.scorecard?.transparency?.rationale || "",
        },
        total: Math.max(0, Math.min(100, parsed.scorecard?.total || 0)),
      },
      follow_up_questions: (parsed.follow_up_questions || []).slice(0, 6),
      caption: (parsed.caption || "").slice(0, 120),
      generated_at: new Date().toISOString(),
      version: DECODER_CONFIG_VERSION,
    };

    return report;
  } catch (error) {
    console.error("Failed to parse decoder response:", error);
    throw new ParseError(
      "Invalid decoder response format",
      "decoder_response",
      {
        originalError: error instanceof Error ? error.message : String(error),
        responseLength: text.length,
        responsePreview: text.slice(0, 200),
      }
    );
  }
}

/**
 * Generate decoder report using AI
 */
async function generateDecoderReportRaw(
  listing: ListingJSON,
  augment: AugmentJSON,
  prefs?: DecoderPrefs
): Promise<DecoderReport> {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    throw new ConfigurationError("OPENAI_API_KEY", {
      address: listing.listing.address,
    });
  }

  const prompt = buildPrompt(listing, augment, prefs);
  const model = openai(DECODER_MODEL);

  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7, // Some creativity but stay factual
      });

      return parseDecoderResponse(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a rate limit or server error
      const errorMessage = lastError.message.toLowerCase();
      const isRateLimit = errorMessage.includes("429") || errorMessage.includes("rate limit");
      const isServerError = errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503");
      
      // Retry on rate limits (429) or server errors (5xx)
      if (attempt < maxRetries && (isRateLimit || isServerError)) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
        continue;
      }
      
      // Don't retry - throw API error
      if (isRateLimit) {
        throw new APIError("OpenAI", "Rate limit exceeded", lastError, 429, {
          model: DECODER_MODEL,
          attempt,
        });
      }
      
      throw new APIError(
        "OpenAI",
        lastError.message,
        lastError,
        isServerError ? 502 : 500,
        {
          model: DECODER_MODEL,
          attempt,
        }
      );
    }
  }

  throw new APIError(
    "OpenAI",
    lastError?.message || "Failed to generate decoder report after retries",
    lastError || undefined,
    502,
    { model: DECODER_MODEL }
  );
}

/**
 * Get or create decoder report
 * Uses cache to avoid duplicate AI calls
 */
export async function getOrCreateDecoderReport(
  listing: ListingJSON,
  augment: AugmentJSON,
  prefs?: DecoderPrefs
): Promise<DecoderReport> {
  const addr = addrHash(listing.listing.address);
  const prefsKey = prefs ? prefsHash(prefs) : "default";
  const hash = reportHash(addr, prefsKey, DECODER_CONFIG_VERSION);
  const version = DECODER_CONFIG_VERSION;

  return getOrSet(
    cacheKey(CACHE_PREFIXES.REPORT, `${addr}:${prefsKey}`, version),
    CACHE_TTL.REPORT,
    async () => {
      return generateDecoderReportRaw(listing, augment, prefs);
    }
  );
}

