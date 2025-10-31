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
 * Plan keys are lowercase snake_case: "basic_plan", "pro_plan"
 * @param planKey - Plan key to check (e.g., 'basic_plan', 'pro_plan')
 */
export async function hasPlan(planKey: string): Promise<boolean> {
  try {
    const { has } = await auth();
    return await has({ plan: planKey });
  } catch (error) {
    console.error(`Error checking plan ${planKey}:`, error);
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
 * Get user's current plan key from Clerk
 * Returns plan key: "pro_plan", "basic_plan", or null
 * Internally maps to display name: "Pro", "Basic"
 */
export async function getUserPlan(): Promise<string | null> {
  try {
    const { has, userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Check plans using their keys (lowercase snake_case)
    // Plan keys are defined in Clerk Dashboard
    const hasPro = await has({ plan: "pro_plan" });
    const hasBasic = await has({ plan: "basic_plan" });

    // Return display name for backward compatibility
    if (hasPro) return "Pro";
    if (hasBasic) return "Basic";

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

    // Check if user has any plan using plan keys
    const hasBasic = await has({ plan: "basic_plan" });
    const hasPro = await has({ plan: "pro_plan" });

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

    // Check if user has any paid plan using plan keys
    const hasBasic = await has({ plan: "basic_plan" });
    const hasPro = await has({ plan: "pro_plan" });

    return hasBasic || hasPro;
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return false;
  }
}
