# Clerk Billing Setup Guide

This guide walks you through setting up Clerk Billing for Landlord Decoder.

## Prerequisites

- Clerk account with billing enabled
- Stripe account (can use Clerk's development gateway for testing)
- Next.js app with Clerk authentication already configured

## Step 1: Enable Clerk Billing

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Billing** → **Settings**
3. Click **Enable Billing**
4. Choose your business model:
   - **B2C SaaS**: Charge individual users (recommended for this app)
   - **B2B SaaS**: Charge organizations
   - **Both**: Combine both models

## Step 2: Set Up Payment Gateway

1. In Clerk Dashboard → **Billing** → **Settings**
2. Choose payment gateway:
   - **Development Gateway**: Shared test Stripe account (for development)
   - **Your Own Stripe Account**: Connect your Stripe account (for production)

### For Production:

1. Connect your Stripe account
2. Note: Clerk requires a **new Stripe account** created through Clerk (cannot use existing Stripe accounts)
3. Stripe accounts are environment-specific (dev vs prod)

## Step 3: Create Subscription Plans

1. In Clerk Dashboard → **Billing** → **Plans**
2. Create your plans (e.g., Free, Pro, Team)

### Recommended Plans:

**Free Plan:**
- Name: `free`
- Price: $0/month
- Features: Basic access, one free decode

**Pro Plan:**
- Name: `pro`
- Price: $9.99/month (or your preferred price)
- Features:
  - `unlimited_decodes` - Unlimited property decodes
  - (Add more features as needed)

**Team Plan (Optional):**
- Name: `team`
- Price: $29/month
- Features: Team collaboration features

### Adding Features to Plans:

1. For each plan, click **Edit**
2. Add features (e.g., `unlimited_decodes`, `batch_decode`)
3. These features can be checked using `has({ feature: 'unlimited_decodes' })`

## Step 4: Configure Webhook Endpoint

1. In Clerk Dashboard → **Webhooks**
2. Create a new webhook endpoint:
   - **Endpoint URL**: `https://yourdomain.com/api/webhooks/clerk`
   - **Events to subscribe**:
     - `subscription.created`
     - `subscription.updated`
     - `subscription.canceled`
     - `subscription.renewed`
     - `payment.succeeded`
     - `payment.failed`

3. Copy the **Signing Secret** (starts with `whsec_`)
4. Add to your environment variables:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

## Step 5: Environment Variables

Add the following to your `.env.local` (and production environment):

```bash
# Clerk Billing (already configured for auth)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Clerk Webhook Secret (from Step 4)
CLERK_WEBHOOK_SECRET=whsec_...

# Vercel KV (for subscription caching - optional)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

## Step 6: Test the Integration

1. **Test Pricing Page**:
   - Navigate to `/pricing`
   - Verify `<PricingTable />` displays your plans

2. **Test Subscription Flow**:
   - Sign in as a test user
   - Click "Subscribe" on a plan
   - Complete checkout (use Stripe test cards)
   - Verify subscription status updates

3. **Test Webhook**:
   - Make a test subscription
   - Check webhook logs in Clerk Dashboard
   - Verify webhook endpoint receives events

4. **Test Access Control**:
   - As free user: Try to decode (should work once)
   - As free user after free check: Should require subscription
   - As Pro user: Should have unlimited decodes

## Step 7: Verify Subscription Checks

The app uses the following methods to check subscriptions:

### Server-Side (API Routes):

```typescript
import { hasActiveSubscription, hasPlan, hasFeature } from "@/lib/entitlements";

// Check if user has any active subscription
const hasSubscription = await hasActiveSubscription(userId);

// Check for specific plan
const isPro = await hasPlan("pro");

// Check for specific feature
const unlimitedDecodes = await hasFeature("unlimited_decodes");
```

### Client-Side (Components):

```typescript
import { useAuth } from "@clerk/nextjs";

const { has } = useAuth();

// Check plan
if (has({ plan: "pro" })) {
  // Show Pro features
}

// Check feature
if (has({ feature: "unlimited_decodes" })) {
  // Allow unlimited decodes
}
```

## Troubleshooting

### PricingTable Not Showing Plans

- Verify billing is enabled in Clerk Dashboard
- Check that plans are created and published
- Ensure you're using the correct Clerk SDK version (`@clerk/nextjs`)

### Webhook Not Receiving Events

- Verify webhook URL is publicly accessible
- Check webhook secret is correct in environment variables
- Review webhook logs in Clerk Dashboard
- Ensure webhook endpoint is handling POST requests correctly

### Subscription Status Not Updating

- Check webhook is configured and receiving events
- Verify webhook handler is updating user metadata
- Use Clerk Dashboard to manually check subscription status
- Clear cache if using KV caching


## References

- [Clerk Billing Overview](https://clerk.com/docs/guides/billing/overview)
- [Clerk Billing for B2C SaaS](https://clerk.com/docs/guides/billing/b2c-saas)
- [Clerk Webhooks](https://clerk.com/docs/webhooks/overview)
- [Clerk Authorization](https://clerk.com/docs/users/authorization)

## Next Steps

- [ ] Set up Stripe account for production
- [ ] Configure webhook endpoint
- [ ] Create subscription plans
- [ ] Test subscription flow
- [ ] Monitor webhook events
- [ ] Set up error handling for failed payments
- [ ] Add subscription management UI (cancel, upgrade, etc.)

