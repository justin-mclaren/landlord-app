# Agents — Development Guide

This document organizes the development approach, key modules, and architectural decisions for **Landlord Decoder**.

---

## Project Overview

**Landlord Decoder** is a Next.js app that decodes rental listings by:

1. Ingesting URLs/addresses from users
2. Fetching property data via RentCast API (with scraping fallback)
3. Augmenting with heuristics (noise, hazards, commute)
4. Generating AI-powered "Decoder Reports" via Vercel AI SDK
5. Serving shareable report pages with OG images

**Core Principle**: Never recompute the same property twice. End-to-end idempotency via aggressive caching.

---

## Architecture Overview

### Data Flow

```
User Input (URL/address)
  → Normalize Input
  → Get/Create Property (RentCast + optional scrape fallback)
  → Augment Property (geo, noise, hazards, commute)
  → Generate Decoder Report (AI)
  → Generate OG Image
  → Publish Report Page
```

### Key Technologies

- **Next.js 16+ (App Router)** — Framework
- **Vercel Durable Workflows** — Multi-step orchestration
- **Vercel AI SDK** — LLM integration
- **Vercel Data Cache** — Caching layer
- **CDN Caching** — Public page caching
- **Clerk** — Auth + Billing
- **RentCast API** — Primary data source
- **Satori/ResVG** — OG image generation

---

## Project Structure

```
src/
├── app/
│   ├── (routes)
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/
│   │   │   └── page.tsx          # Pricing page
│   │   └── d/
│   │       └── [slug]/
│   │           └── page.tsx      # Report page (SSR/ISR)
│   ├── api/
│   │   ├── decode/
│   │   │   └── route.ts          # POST /api/decode
│   │   ├── status/
│   │   │   └── [jobId]/
│   │   │       └── route.ts      # GET /api/status/:jobId
│   │   ├── ingestHtml/
│   │   │   └── route.ts          # POST /api/ingestHtml (extension)
│   │   └── og/
│   │       └── [slug]/
│   │           └── route.ts      # GET /og/[slug].png
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── cache.ts                  # Cache utilities (getOrSet)
│   ├── hash.ts                   # Hash functions (sha256)
│   ├── normalize.ts              # Address normalization
│   ├── rentcast.ts               # RentCast API client
│   ├── scrape.ts                 # Scraping fallback
│   ├── augment.ts                # Augmentation logic
│   ├── decoder.ts                # AI decoder prompt & parsing
│   ├── og-image.ts               # OG image generation
│   ├── slug.ts                   # Slug generation
│   ├── entitlements.ts           # Clerk entitlements helper
│   └── quotas.ts                 # Usage quota tracking (KV)
├── flows/
│   └── decode.ts                 # DecodeFlow workflow
├── types/
│   ├── listing.ts                # ListingJSON type
│   ├── augment.ts                # Augment type
│   ├── report.ts                 # DecoderReport type
│   └── workflow.ts               # Workflow input/output types
└── components/
    ├── ui/                       # Base UI components
    ├── DecodeForm.tsx            # Landing form
    ├── ReportView.tsx            # Report display
    └── PricingTable.tsx          # Clerk PricingTable
```

---

## Core Modules

### 1. Cache Layer (`lib/cache.ts`)

**Purpose**: Idempotent read-through caching for all upstream calls.

**Key Functions**:

- `getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>)`
- `get<T>(key: string)`
- `set<T>(key: string, value: T, options: { ttl: number })`

**Cache Keys** (content-addressed):

- `property:addr:{addrHash}` — Normalized property (7 days TTL)
- `rentcast:addr:{addrHash}:v{N}` — Raw RentCast payload (versioned)
- `scrape:url:{urlHash}:v{N}` — Scrape payload (6 hours TTL)
- `augment:addr:{addrHash}:v{N}` — Augmentation data (7 days TTL)
- `report:{addrHash}:{prefsHash}:v{N}` — Decoder report (7 days TTL)
- `og:{reportHash}:v{N}` — OG image bytes (7 days TTL)

**Hash Functions** (`lib/hash.ts`):

- `addrHash = sha256(normalizedAddress)`
- `prefsHash = sha256(JSON.stringify(prefsSlim))`
- `reportHash = sha256(addrHash + prefsHash + decoderConfigVersion)`

---

### 2. Normalization (`lib/normalize.ts`)

**Purpose**: Convert user input (URL or address string) into canonical address format.

**Key Functions**:

- `normalizeInput(input: { url?: string; address?: string })`
  - If URL: extract address from URL (Zillow, Apartments.com, etc.)
  - If address: parse and normalize format
  - Return: `{ address: string, sourceMeta: {...} }`

**Address Normalization**:

- Lowercase, trim whitespace
- Standardize abbreviations (St → Street, Ave → Avenue)
- Remove extra whitespace
- Output canonical format: `{street}, {city}, {state} {zip}`

---

### 3. Property Fetch (`lib/rentcast.ts` + `lib/scrape.ts`)

**Purpose**: Fetch property data from RentCast API, with scraping fallback.

**RentCast (`lib/rentcast.ts`)**:

- Primary data source
- Fetch by address or lat/lon bounds
- Retry logic: 3 attempts with exponential backoff (respect 429)
- Cache raw response under versioned key
- Return normalized `ListingJSON`

**Scraping Fallback (`lib/scrape.ts`)**:

- Triggered if RentCast missing core fields AND `FEATURE_SCRAPE_FALLBACK=true`
- Two modes:
  1. Browser Extension: POST `/api/ingestHtml` with DOM JSON
  2. Provider API: Server-side scrape (Cheerio or provider API)
- Short TTL cache (6 hours)
- Never blocks RentCast success

**Merge Policy** (`lib/normalize.ts`):

- Prefer RentCast for structured fields (price, beds, baths, sqft)
- Fill `description_raw` and `features` from fallback if missing
- Track `provenance` per field (optional)

---

### 4. Augmentation (`lib/augment.ts`)

**Purpose**: Compute heuristics (geocode, noise, hazards, commute) for a property.

**Augmentations**:

- **Geocode**: If missing lat/lon, geocode `listing.address` (Nominatim/Mapbox)
- **Noise**: Distance to nearest motorway & airport (tiered: high/med/low)
- **Hazards**: Simple polygon lookups (flood/wildfire) if tokens available; else "unknown"
- **Commute**: Optional `prefs.workAddress` → driving ETA window estimate

**Output**: Deterministic `AugmentJSON` (ideal for caching)

---

### 5. AI Decoder (`lib/decoder.ts`)

**Purpose**: Generate Decoder Report using Vercel AI SDK.

**Prompt Structure**:

```
SYSTEM: You are Landlord Decoder. Be blunt but fair. Never invent facts.
USER: Here is a normalized listing + augmentation + preferences.
<json>{{payload}}</json>
Task:
1) 2–3 sentence reality summary.
2) Up to 6 Red Flags (strongest first), citing which field triggers each.
3) Up to 4 Positives.
4) Scorecard: Value, Livability, Noise/Light, Hazards, Transparency (0–10) + Total (0–100) with short rationale.
5) 6 follow-up questions for landlord/agent.
6) A 120-char one-liner caption.
```

**Implementation**:

- Use `generateText()` from `ai` package
- Model: `process.env.DECODER_MODEL ?? "gpt-4o-mini"`
- Parse output into structured JSON (JSON-mode or extraction prompt)
- Cache by `report:{addrHash}:{prefsHash}:v{N}`
- Retry on 429/5xx up to 2 times

---

### 6. OG Image Generation (`lib/og-image.ts`)

**Purpose**: Generate shareable OG images using Satori/ResVG.

**Content**:

- Big score (total from scorecard)
- Title line (address + caption)
- 2 red flags (strongest)
- 1 positive

**Implementation**:

- Render server-side with Satori
- Cache image bytes by `og:{reportHash}:v{N}` (store-once, reuse)
- Return PNG blob

---

### 7. Durable Workflow (`flows/decode.ts`)

**Purpose**: Orchestrate multi-step decode process with retries and idempotency.

**Workflow Steps**:

1. **NormalizeInput** → `{ address, sourceMeta }`
2. **GetOrCreateProperty** → Fetch RentCast, merge scrape if needed, cache
3. **AugmentProperty** → Compute augmentation, cache
4. **GetOrCreateDecodedReport** → Call AI decoder, cache
5. **GenerateOGImage** → Render OG image, cache
6. **Publish** → Generate slug, trigger ISR revalidate, return `{ reportUrl }`

**Retries & Backoff**:

- RentCast: 3 retries with jitter (exponential backoff on 429)
- Fallback scrape: Single shot + short TTL cache
- AI step: 2 retries on 429/5xx

**Timeouts**:

- Target p95 < 8–12s on warm cache
- Cold path can stream status

---

### 8. Entitlements & Quotas (`lib/entitlements.ts` + `lib/quotas.ts`)

**Purpose**: Gate features and track usage limits via Clerk Billing.

**Entitlements** (`lib/entitlements.ts`):

- Map plan → features (Free: 5 decodes/month, watermark; Pro: 200 decodes/month, no watermark, batch decode)
- Server-side helper: `hasFeature(userId, feature: string)`
- Client-side: Use Clerk's `<Protect />` component

**Quotas** (`lib/quotas.ts`):

- Track usage via Vercel KV: `usage:{userId}:{YYYY-MM}` with atomic `incr`
- Middleware checks quota before allowing `POST /api/decode`
- Consume 1 unit on successful publish step
- Reset on cycle boundaries (monthly UTC)

**Note**: Clerk Billing doesn't support metered billing yet; implement quotas manually. If/when Clerk adds metered billing, migrate to emit usage to Clerk.

---

## API Routes

### `POST /api/decode`

**Body**:

```json
{
  "url": "https://...",
  "address": "123 Main St, City, ST",
  "prefs": { "workAddress": "..." }
}
```

**Response**:

```json
{
  "status": "ok",
  "url": "/d/san-francisco-123-main-st-apt-4"
}
```

**Flow**:

1. Validate input
2. Check quota (via middleware)
3. Start DecodeFlow workflow
4. Return report URL (or jobId + polling endpoint for async)

---

### `GET /api/status/:jobId`

**Response**:

```json
{
  "status": "processing",
  "step": "AugmentStage",
  "progress": 0.6
}
```

**Use Case**: For async workflows, client polls this endpoint for progress.

---

### `POST /api/ingestHtml`

**Body**:

```json
{
  "url": "https://...",
  "html": "...",
  "metadata": {...}
}
```

**Use Case**: Browser extension posts scraped DOM data. Normalize and cache.

---

### `GET /og/[slug].png`

**Response**: PNG image blob

**Use Case**: OG image for social sharing. Cache aggressively.

---

## Pages

### `GET /` (Landing Page)

**Component**: `DecodeForm`

- Input: URL or address
- Optional: Work address (for commute)
- Submit → `POST /api/decode`
- Show loading/progress state

---

### `GET /d/[slug]` (Report Page)

**Component**: `ReportView`

- SSR/ISR with long CDN cache (`s-maxage=86400, stale-while-revalidate=604800`)
- Display:
  - Summary
  - Red Flags
  - Positives
  - Scorecard
  - Follow-up Questions
  - Share card
- Conditional watermark if `!has({ plan: 'pro' })`

---

### `GET /pricing` (Pricing Page)

**Component**: `<PricingTable />` from Clerk

- Render plans (Free, Pro, Team)
- Checkout handled by Clerk (no custom Stripe routes)

---

## Environment Variables

```bash
# Required
RENTCAST_API_KEY=...
OPENAI_API_KEY=... # or model provider key
APP_URL=https://yourapp.com

# Optional
SCRAPE_PROVIDER_KEY=... # ZenRows/Apify
MAPBOX_TOKEN=...
CLERK_SECRET_KEY=...
KV_REST_API_URL=... # Vercel KV for quotas
KV_REST_API_TOKEN=...

# Feature Flags
FEATURE_SCRAPE_FALLBACK=true|false
FEATURE_VISION_PASS=true|false
DECODER_MODEL=gpt-4o-mini|gpt-4.1|...
```

---

## Development Phases

### Phase 1: Foundation (Week 1)

- [ ] Set up Next.js project structure
- [ ] Implement cache layer (`lib/cache.ts`)
- [ ] Implement hash utilities (`lib/hash.ts`)
- [ ] Implement normalization (`lib/normalize.ts`)
- [ ] Integrate RentCast API (`lib/rentcast.ts`)
- [ ] Create `ListingJSON` type (`types/listing.ts`)
- [ ] Basic report rendering (`components/ReportView.tsx`)
- [ ] Landing page with form (`components/DecodeForm.tsx`)

### Phase 2: Workflow & Caching (Week 2)

- [ ] Implement Durable Workflow (`flows/decode.ts`)
- [ ] Implement augmentation (`lib/augment.ts`)
- [ ] Implement AI decoder (`lib/decoder.ts`)
- [ ] Implement OG image generation (`lib/og-image.ts`)
- [ ] Set up API routes (`/api/decode`, `/api/status/:jobId`)
- [ ] Configure CDN caching for `/d/[slug]`
- [ ] Implement rate limiting

### Phase 3: Fallback & Polish (Week 3)

- [ ] Implement scraping fallback (`lib/scrape.ts`)
- [ ] Browser extension endpoint (`/api/ingestHtml`)
- [ ] Enhance augmentation heuristics
- [ ] Polish UI/UX
- [ ] Add error handling & retries

### Phase 4: Monetization & Launch (Week 4)

- [ ] Integrate Clerk Auth
- [ ] Set up Clerk Billing (plans, pricing table)
- [ ] Implement entitlements (`lib/entitlements.ts`)
- [ ] Implement quotas (`lib/quotas.ts`)
- [ ] Add observability (logging, metrics)
- [ ] Add cost controls (spend guardrails)
- [ ] Landing page polish
- [ ] Launch prep

---

## Key Decisions & Assumptions

### Scraping Fallback

- **Decision**: Prefer browser extension (TOS-friendly). Provider API alternative behind flag.
- **Rationale**: Extension only scrapes pages user has open; avoids TOS issues.

### Persistence

- **Decision**: Cache-only MVP initially. Postgres optional for analytics.
- **Rationale**: Simpler architecture; can add Postgres later if needed.

### Augmentation Sources

- **Decision**: Start with free OSM/Nominatim; Mapbox optional if tokens available.
- **Rationale**: Lower cost for MVP; can upgrade later.

### Model Choice

- **Decision**: Default to `gpt-4o-mini` via Vercel AI SDK; use JSON-mode for structured output.
- **Rationale**: Cost-effective, good quality, structured output improves parsing reliability.

### Brand/Design

- **Decision**: TBD — design system to be defined.
- **Note**: User preference: white/black with dark green highlight, light grey contrast, no purple.

---

## Testing Strategy

### Unit Tests

- Cache utilities
- Hash functions
- Normalization logic
- Augmentation heuristics

### Integration Tests

- RentCast API client (mock responses)
- Workflow steps (mock dependencies)
- API routes (end-to-end)

### E2E Tests

- Full decode flow (happy path)
- Fallback scraping flow
- Quota enforcement
- Error handling

---

## Observability

### Logging

- Structured logs with step timings
- Cache hit/miss counters
- External API call tracking

### Metrics

- Cache hit ratio
- External API spend
- Workflow duration
- Error rate

### Error Budgets

- Automatically disable fallback scraping if flaky/costly
- Circuit-break providers on repeated failures

---

## Cost Controls

### Strategies

1. **Caching first** — Never recompute same property
2. **Collapse duplicate requests** — Singleflight pattern
3. **Backoff on 429/5xx** — Respect rate limits
4. **Circuit-break providers** — Disable flaky integrations
5. **Daily spend guardrails** — Per-provider limits
6. **Graceful degradation** — Show partial report + "data pending"

---

## Security & Compliance

### Rate Limiting

- Anonymous users: IP + fingerprint
- Logged-in users: Per user + daily limits

### Privacy

- Don't store PII beyond address
- Allow deletion of user data

### TOS Compliance

- Respect 3rd-party TOS
- Clearly label data sources
- Disclaim hazard/score as estimates

---

## Future Enhancements (Post-MVP)

- Photo vision checks (wide-angle detection, light, street proximity)
- Price-to-area local percentile using nearby listings index
- User accounts (Clerk) for saved reports, batches, CSV export
- City/Neighborhood leaderboards
- Embeddable badges for honest landlords
- Bridge/MLS partner feed for durable, terms-clean data at scale

---

## Notes for AI Agents

When implementing features:

1. **Always check cache first** — Use `getOrSet()` pattern
2. **Version cache keys** — Include schema version (`:v{N}`) to bust on changes
3. **Idempotency is critical** — Same input should always produce same output
4. **Never block on fallback** — Scraping fallback should never block RentCast success
5. **Respect rate limits** — Implement exponential backoff for all external APIs
6. **Error handling** — Degrade gracefully; show partial data when possible
7. **CDN caching** — Public pages should have long cache headers
8. **Quota enforcement** — Check quotas before processing, consume after success
9. **Feature flags** — Use environment variables for feature toggles
10. **Cost awareness** — Log API spend, implement guardrails

---

**Last Updated**: Initial creation
**Next Review**: After Phase 1 completion
