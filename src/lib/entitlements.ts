/**
 * Subscription Status Check
 * Helper functions to check subscription status and plan features via Clerk Billing
 *
 * Clerk Billing API: https://clerk.com/docs/guides/billing/overview
 * Uses Clerk's built-in subscription management - no custom metadata tracking needed
 */

import { auth } from "@clerk/nextjs/server";

/**
 * Check if user has a specific plan
 * Plan names are capitalized: "Basic", "Pro"
 * @param planName - Plan name to check (e.g., 'Basic', 'Pro')
 */
export async function hasPlan(planName: string): Promise<boolean> {
  try {
    const { has } = await auth();
    return await has({ plan: planName });
  } catch (error) {
    console.error(`Error checking plan ${planName}:`, error);
    return false;
  }
}

/**
 * Check if user has a specific feature
 * Features are defined in Clerk Dashboard for each plan
 * @param featureName - Feature name to check (e.g., 'batch_decode', 'unlimited_decodes')
 */
export async function hasFeature(featureName: string): Promise<boolean> {
  try {
    const { has } = await auth();
    return await has({ feature: featureName });
  } catch (error) {
    console.error(`Error checking feature ${featureName}:`, error);
    return false;
  }
}

/**
 * Get user's current plan name from Clerk
 * Returns capitalized plan name: "Basic", "Pro", or null
 */
export async function getUserPlan(): Promise<string | null> {
  try {
    const { has } = await auth();

    // Check plans in order (Pro > Basic)
    // Clerk handles plan names as-is (capitalized)
    if (await has({ plan: "Pro" })) return "Pro";
    if (await has({ plan: "Basic" })) return "Basic";

    return null;
  } catch (error) {
    console.error("Error getting user plan:", error);
    return null;
  }
}

/**
 * Get user's subscription status from Clerk
 * Returns 'trialing', 'active', 'canceled', or null
 * Clerk automatically tracks subscription status
 */
export async function getSubscriptionStatus(): Promise<string | null> {
  try {
    const { has } = await auth();

    // Check if user has any plan (Clerk handles status internally)
    // If has() returns true, subscription is active or trialing
    const hasBasic = await has({ plan: "Basic" });
    const hasPro = await has({ plan: "Pro" });

    if (hasBasic || hasPro) {
      // Clerk's has() returns true for both active and trialing subscriptions
      // To distinguish, we'd need to check the subscription object directly
      // For now, assume active if has() returns true
      // Trial status is handled by checking if trial decode hasn't been used yet
      return "active";
    }

    return null;
  } catch (error) {
    console.error("Error getting subscription status:", error);
    return null;
  }
}

/**
 * Check if user has an active subscription (Basic or Pro)
 * Includes trialing subscriptions (Clerk handles trial state automatically)
 */
export async function hasActiveSubscription(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const { has } = await auth();

    // Check if user has any paid plan
    // Clerk's has() returns true for both active and trialing subscriptions
    const hasBasic = await has({ plan: "Basic" });
    const hasPro = await has({ plan: "Pro" });

    return hasBasic || hasPro;
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return false;
  }
}
