# Landlord Decoder — Next.js on Vercel (RentCast + Durable Workflows)

A product spec and implementation plan for a viral, consumer‑facing app that decodes rental listings. Primary ingestion uses **RentCast API**; a **scraping fallback** fills gaps. Multi‑step processing is orchestrated via **Vercel Durable Workflows** and the **Vercel AI SDK**. Results are cached aggressively with **Vercel Data Cache** and **CDN caching** to avoid duplicate work.

---

## 1) Goals & Non‑Goals

**Goals**

- Ingest a user‑supplied rental listing (ideally a Zillow/Apartments.com URL or raw address).
- Normalize property data via **RentCast**; if insufficient, use scraping fallback (extension/provider).
- Augment with heuristics (walkability/noise/hazards/commute).
- Generate a readable **Decoder Report** (summary, red flags, positives, scorecard, Q&A, share card).
- **Never recompute the same property twice**: end‑to‑end idempotency with data & CDN caching.
- Ship fast: clean DX, small stack, cost‑aware.

**Non‑Goals (MVP)**

- Real‑time MLS sync; partner feeds (future).
- Definitive hazard/insurance underwriting (advisory only).
- Full comps engine; advanced vision QA (can follow later).

---

## 2) System Overview

**Happy path**: URL → derive address/ID → fetch RentCast data → augment → AI “decode” → render public report page with OG image.

**Fallback path**: URL → cannot resolve via RentCast → invoke scraping fallback (browser extension payload or provider API) → normalize → continue.

**Caching & idempotency**: Content‑addressed keys (hash of canonical address + provider version). All steps read through the cache first and write atomically, ensuring we never do the same upstream request twice.

---

## 3) Architecture Diagram (textual)

```
[Client]
  └── POST /api/decode { url|address, prefs }
       └── Durable Workflow (DecodeFlow)
            1) NormalizeInput → addr, sourceMeta
            2) GetOrCreateProperty(addr)
               2a) getFromDataCache('rentcast:addr:...')
               2b) else fetchRentCast(addr) → put → return
               2c) if missing fields → ScrapeFallback(url) → merge → put
            3) AugmentProperty(property)
            4) GetOrCreateDecodedReport(property)
               4a) dataCache('report:hash') else
               4b) AI SDK call → LLM output → persist & cache
            5) GenerateOGImage(report)
            6) Return {reportUrl} and trigger ISR revalidate

[Storage/Caching]
- Vercel Data Cache (KV‑like; read‑through)
- (Optional) Postgres for analytics/auditing, otherwise object storage only
- CDN cache for result pages (/d/[slug]) with long max‑age + revalidate hooks
```

---

## 4) Tech Stack

- **Next.js (App Router)** with Edge‑ready routes where feasible.
- **Vercel Durable Workflows** for multi‑step, retryable orchestration.
- **Vercel AI SDK** (`ai`) to prompt LLMs for the Decoder Report.
- **Vercel Data Cache** (build on `cache()` / fetch cache, or RSC cache) for memoization of upstream calls & AI results.
- **CDN caching** for public result pages (stale‑while‑revalidate).
- **Cheerio** (server) or **Chrome Extension** (client) for DOM extraction in fallback.
- **Map/Geo** (optional MVP): Nominatim/Mapbox for geocoding; simple heuristics for noise/hazards.

---

## 5) Environment & Config

```
RENTCAST_API_KEY=...
SCRAPE_PROVIDER_KEY=...(optional; e.g., ZenRows/Apify)
OPENAI_API_KEY=... (or model provider key used via Vercel AI SDK)
MAPBOX_TOKEN=...(optional)
APP_URL=https://yourapp.com
```

- **Feature flags** via environment variables:

  - `FEATURE_SCRAPE_FALLBACK=true|false`
  - `FEATURE_VISION_PASS=true|false`
  - `DECODER_MODEL=gpt-4o-mini|gpt-4.1|...`

---

## 6) Routing & Pages

- `GET /` → Landing with URL/address input.
- `POST /api/decode` → Starts **DecodeFlow**; returns `reportUrl` or `jobId` + polling endpoint.
- `GET /status/:jobId` → Workflow status (queued/processing/complete/error).
- `GET /d/[slug]` → Public, shareable Report page (SSR/ISR). Long CDN cache, SWR.
- `GET /og/[slug].png` → Server OG image.

**CDN Cache strategy**

- `/d/[slug]`: `Cache-Control: s-maxage=86400, stale-while-revalidate=604800`.
- Invalidate on data changes via a lightweight revalidate API or tag‑based revalidation.

---

## 7) Data Model (Cache‑First)

**Canonical keys** (all lowercased, trimmed, ASCII):

- `property:addr:{addrHash}` → normalized property JSON.
- `rentcast:addr:{addrHash}:v{N}` → raw RentCast payload (versioned to bust schema changes).
- `scrape:url:{urlHash}:v{N}` → raw scrape payload (light TTL).
- `augment:addr:{addrHash}:v{N}` → augmentation JSON.
- `report:{addrHash}:{prefsHash}:v{N}` → Decoder Report JSON.
- `og:{reportHash}:v{N}` → OG image bytes/URL.

**Hashes**

- `addrHash = sha256(normalizedAddress)`
- `prefsHash = sha256(JSON.stringify(prefsSlim))`
- `reportHash = sha256(addrHash + prefsHash + decoderConfigVersion)`

**Idempotency**

- All write operations use compare‑and‑set semantics (write only if missing) and return existing value if present.

---

## 8) Durable Workflow (DecodeFlow)

**Definition (conceptual)**

```
DecodeFlow(input: { url?: string; address?: string; prefs?: DecoderPrefs })
  step NormalizeInput → { address, sourceMeta }
  step PropertyStage(address):
    if cache.get(property:addr:addrHash) → return
    else:
      rentcast = cache.get(rentcast:addr:addrHash) || fetchRentCast(address)
      if rentcast.missingCoreFields and FEATURE_SCRAPE_FALLBACK:
        scrape = cache.get(scrape:url:urlHash) || scrapeByUrl(input.url)
        property = normalizeMerge(rentcast, scrape)
      else property = normalize(rentcast)
      cache.put(property:addr:addrHash, property)
  step AugmentStage(property):
    augment = cache.get(augment:addr:addrHash) || computeAugment(property)
    cache.put(augment:addr:addrHash, augment)
  step ReportStage(property, augment, prefs):
    report = cache.get(report:addrHash:prefsHash) || callDecoderAI(property, augment, prefs)
    cache.put(report:addrHash:prefsHash, report)
  step OGStage(report):
    og = cache.get(og:reportHash) || renderOG(report)
    cache.put(og:reportHash, og)
  step Publish:
    slug = makeSlug(property, report)
    triggerISR(slug)
    return { url: `/d/${slug}` }
```

**Retries & backoff**

- RentCast: retry 3 times with jitter (respect 429 with exponential backoff).
- Fallback scrape: single shot + short TTL cache; never blocks RentCast success.
- AI step: retry on 429/5xx up to 2 times; store prompt+hash for reproducibility.

**Timeouts**

- End‑to‑end SLA: target p95 < 8–12s on warm cache; cold path allowed to stream status.

---

## 9) External Integrations

**RentCast**

- Primary fetch by address or lat/lon bounds.
- Persist raw response under a versioned key; keep a slim normalized subset in `property:*`.

**Scraping Fallback (two options)**

- **Browser Extension**: content script extracts visible DOM into JSON and POSTs to `/api/ingestHtml` (only for pages the user has open; TOS‑friendly).
- **Provider API**: Accept `url` and receive normalized JSON (rate‑limited; clearly flagged as fallback).

---

## 10) Normalization

**ListingJSON (normalized)**

```ts
export type ListingJSON = {
  source: {
    url?: string;
    fetched_at: string;
    provider: "rentcast" | "scrape" | "merge";
  };
  listing: {
    address: string;
    city: string;
    state: string;
    zip?: string;
    lat?: number;
    lon?: number;
    price?: number;
    price_currency?: "USD";
    price_type?: "rent" | "buy";
    beds?: number;
    baths?: number;
    sqft?: number | null;
    year_built?: number | null;
    features?: string[];
    description_raw?: string;
  };
};
```

**Merge policy**

- Prefer RentCast for structured fields (price, beds, baths, sqft).
- Fill `description_raw` and `features` from fallback if missing.
- Track `provenance` per field for audit (optional).

---

## 11) Augmentation (MVP)

- **Geocode**: if missing, geocode `listing.address`.
- **Noise**: distance to nearest motorway & airport (tiered: high/med/low).
- **Hazards**: simple polygon lookups (flood/wildfire) if tokens available; else “unknown”.
- **Commute**: optional `prefs.workAddress` → driving ETA window estimate.

Augment JSON is deterministic → ideal for caching.

---

## 12) AI “Decoder” (Vercel AI SDK)

**Prompt skeleton**

```
SYSTEM: You are Landlord Decoder. Be blunt but fair. Never invent facts.
USER: Here is a normalized listing + augmentation + preferences.
<json>{{payload}}</json>
Task:
1) 2–3 sentence reality summary.
2) Up to 6 Red Flags (strongest first), citing which field triggers each.
3) Up to 4 Positives.
4) Scorecard: Value, Livability, Noise/Light, Hazards, Transparency (0–10) + Total (0–100) with short rationale.
5) 6 follow‑up questions for landlord/agent.
6) A 120‑char one‑liner caption.
```

**Call (pseudo‑code)**

```ts
import { generateText } from "ai";

const { text } = await generateText({
  model: process.env.DECODER_MODEL ?? "gpt-4o-mini",
  prompt: buildPrompt(payload),
});
```

**Output**

- Parse into structured JSON with a small extraction prompt or use JSON‑mode.
- Cache by `report:{addrHash}:{prefsHash}:v{N}`.

---

## 13) OG Image & Share Card

- Render with Satori/ResVG on server: big score, title line, 2 red flags, 1 positive.
- Cache image bytes by `og:{reportHash}:v{N}` (store‑once, reuse across requests).

---

## 14) Caching Strategy (Deep‑Dive)

**Vercel Data Cache**

- All upstream calls wrapped with a `getOrSet(key, ttl, fetcher)` helper.
- **Long TTL** for property & report (e.g., 7 days). **Short TTL** for scrape fallback (e.g., 6 hours).
- Include a **schema version** suffix in keys to force busts on changes.

**CDN Cache**

- `/d/[slug]` served with `s-maxage=1 day` + SWR 7 days.
- Revalidate page when a new report is created or a property is refreshed.

**Idempotency tokens**

- `X-Idempotency-Key` header supported on `/api/decode` to coalesce duplicate client submits.

---

## 15) Security & Compliance

- Rate limit anonymous users (IP+fingerprint) and logged‑in users per day.
- Don’t store PII beyond address; allow deletion.
- Respect 3rd‑party TOS; clearly label data sources and that hazard/score are estimates.

---

## 15.5) Monetization & Entitlements (Clerk Billing + Quotas)

**Why Clerk Billing:** Native subscription UX with **no extra webhook code**—plans are defined in Clerk, `<PricingTable />` renders checkout, and subscription state is stored alongside the user/org. Under the hood you connect **Stripe**, but integration is handled by Clerk. citeturn0view0

**Plans (example)**

- **Free**: 5 decodes/month, rate‑limited.
- **Pro** ($9.99/mo): 200 decodes/month, batch decode, priority queue.
- **Team** ($29/mo/seat)**(roadmap once per‑seat is live)**.

**Entitlements & gating**

- Use Clerk’s **`has()`** helper or `<Protect />` to gate components and API routes by plan/features. We’ll mirror entitlements in a small helper (`entitlements.ts`) for server checks. citeturn0view0

**Quotas (usage limits)**

- Clerk Billing **does not yet support metered/usage billing**; we implement quotas via Vercel KV (or Postgres):

  - Key: `usage:{userId}:{YYYY-MM}` with atomic `incr`.
  - Middleware reads Clerk plan via `auth()` and current usage to allow/deny `POST /api/decode`.
  - On successful publish step, **consume** 1 unit.
  - Reset counter on cycle boundaries (we can read next renewal from Clerk subscription data or reset monthly on UTC).
  - If/when Clerk adds **metered billing**, we can emit usage to Clerk instead of KV. citeturn0view0

**Implementation notes**

- **Pricing UI**: drop `<PricingTable />` into `/pricing`; link from upgrade walls.
- **Checkout/Portal**: handled by Clerk—no custom Stripe routes needed; remove `/api/billing/checkout|portal|webhook` from MVP.
- **Feature flags**: Map plan → features (e.g., `plan: 'pro'` → `features: ['batch_decode','unlimited_decodes']`).

**Compliance & fees**

- Billing fees “same as Stripe” + Clerk billing fee as documented; Clerk does **not process cards** itself and requires connecting Stripe. citeturn0view0

---

## 16) Observability

- Structured logs with step timings & cache hit/miss counters.
- Metrics: cache hit ratio, external API spend, workflow duration, error rate.
- Error budgets to disable fallback scraping automatically if it becomes flaky/costly.

---

## 17) Cost Controls

- Caching first; collapse duplicate in‑flight requests (singleflight pattern).
- Backoff on 429/5xx; circuit‑break provider on repeated failures.
- Daily spend guardrails per provider; degrade gracefully (show partial report + “data pending”).

---

## 18) Minimal Schema (Optional DB)

If using Postgres for analytics/audit:

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  addr_hash text not null,
  prefs_hash text not null,
  report_hash text not null,
  slug text not null unique,
  summary jsonb not null,
  created_at timestamptz default now()
);
```

Otherwise, rely purely on Data Cache + static JSON in object storage.

---

## 19) API Contracts (MVP)

### `POST /api/decode`

**Body**

```json
{
  "url": "https://...",
  "address": "123 Main St, City, ST",
  "prefs": { "workAddress": "..." }
}
```

**Response**

```json
{ "status": "ok", "url": "/d/san-francisco-123-main-st-apt-4" }
```

### `GET /status/:jobId`

```json
{ "status": "processing", "step": "AugmentStage", "progress": 0.6 }
```

---

## 20) Example Pseudo‑Code

```ts
// lib/cache.ts
export async function getOrSet<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached) return cached;
  const val = await fn();
  await cache.set(key, val, { ttl });
  return val;
}
```

```ts
// app/api/decode/route.ts
export async function POST(req: Request) {
  const { url, address, prefs } = await req.json();
  const input = await normalizeInput({ url, address });
  const { reportUrl } = await DecodeFlow.start(input); // durable workflow
  return Response.json({ status: "ok", url: reportUrl });
}
```

```ts
// flows/decode.ts (conceptual)
export const DecodeFlow = createWorkflow("decode", async (input) => {
  const addr = await NormalizeInput.run(input);
  const property = await GetOrCreateProperty.run(addr, input.url);
  const augment = await GetOrCreateAugment.run(property);
  const report = await GetOrCreateReport.run({
    property,
    augment,
    prefs: input.prefs,
  });
  const og = await GetOrCreateOG.run(report);
  const slug = await publishReport(property, report);
  return { reportUrl: `/d/${slug}` };
});
```

---

## 21) Rollout Plan

1. **Week 1**: RentCast integration + normalization, cache keys, basic report rendering.
2. **Week 2**: Durable Workflows orchestration + OG image + CDN caching + rate limits.
3. **Week 3**: Scraping fallback (extension) + augmentation heuristics + polish.
4. **Week 4**: Observability, cost guards, landing/marketing, launch video.

---

## 22) Future Enhancements

- Photo vision checks (wide‑angle detection, light, street proximity).
- Price‑to‑area local percentile using your own small index of nearby listings.
- User accounts (Clerk) for saved reports, batches, CSV export.
- City/Neighborhood leaderboards; embeddable badges for honest landlords.
- Bridge/MLS partner feed for durable, terms‑clean data at scale.

---

## 23) Open Questions (assumptions made for now)

- **Scrape fallback**: prefer **browser extension** (TOS‑friendly). Okay to include a provider alternative behind a flag?
- **Persistence**: cache‑only MVP vs adding Postgres for analytics—do we want basic usage dashboards on day one?
- **Augmentation sources**: which geo providers do we want in MVP (Mapbox vs. free OSM/Nominatim only)?
- **Model choice**: default to `gpt-4o‑mini` via Vercel AI SDK; any preference for JSON‑mode/structured output?
- **Brand/Design**: any OG image style or score palette defined?
