# Testing Guide

## Server Status
✅ Dev server is running at http://localhost:3000
✅ Landing page renders correctly with DecodeForm component
✅ TypeScript compilation passes

## Environment Variables Needed

Before testing the full decode flow, you'll need to set up environment variables:

Create a `.env.local` file (or set these in your environment):

```bash
# Required
RENTCAST_API_KEY=your_rentcast_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional
APP_URL=http://localhost:3000
MAPBOX_TOKEN=  # Optional - for better geocoding
DECODER_MODEL=gpt-4o-mini  # Optional - defaults to gpt-4o-mini
```

## Testing Steps

### 1. Test Landing Page
- ✅ Navigate to http://localhost:3000
- ✅ Verify DecodeForm renders with:
  - URL input field
  - Address input field
  - Work address input (optional)
  - Submit button

### 2. Test Decode Flow (requires API keys)

#### Option A: Test with Address
```bash
curl -X POST http://localhost:3000/api/decode \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Main St, San Francisco, CA 94102",
    "prefs": {}
  }'
```

Expected response:
```json
{
  "status": "ok",
  "url": "/d/san-francisco-123-main-st-..."
}
```

#### Option B: Test with URL
```bash
curl -X POST http://localhost:3000/api/decode \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.zillow.com/homedetails/...",
    "prefs": {
      "workAddress": "123 Work St, San Francisco, CA"
    }
  }'
```

### 3. Test Report Page
After generating a report, navigate to the returned URL:
- `http://localhost:3000/d/[slug]`
- Should display the full decoder report with:
  - Summary
  - Red Flags
  - Positives
  - Scorecard
  - Follow-up Questions

### 4. Test OG Image
After generating a report:
- Navigate to: `http://localhost:3000/og/[slug].png`
- Should return an SVG image (PNG conversion TODO)

## Known Issues / TODOs

1. **RentCast API**: The endpoint format may need adjustment based on actual RentCast API documentation
2. **OG Image**: Currently returns SVG, PNG conversion needed for better compatibility
3. **Storage**: Using Next.js cache (not persistent across deployments)
4. **Error Handling**: Some error cases may need better user-facing messages

## Testing Without API Keys

To test the UI without API keys:
1. The landing page will work fine
2. The decode endpoint will fail with a clear error message
3. You can mock the API responses for local testing

## Next Steps

1. Get RentCast API key and test property fetching
2. Get OpenAI API key and test AI decoder
3. Test full end-to-end flow
4. Fix any issues found during testing
5. Add error handling improvements
6. Consider adding unit tests for key functions

