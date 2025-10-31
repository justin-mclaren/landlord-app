/**
 * Subscription Status Check
 * Helper functions to check subscription status and plan features via Clerk Billing
 * 
 * Clerk Billing API: https://clerk.com/docs/guides/billing/overview
 */

import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Check if user has an active subscription
 * Uses Clerk's auth().has() method to check for any active subscription plan
 */
export async function hasActiveSubscription(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const { has } = await auth();
    
    // Check if user has any active subscription plan
    // Clerk's has() method checks subscription status automatically
    // You can check for specific plans like: has({ plan: 'pro' })
    // Or check for any plan by checking for subscription-related features
    
    // Check for common subscription indicators
    // Adjust these based on your actual plan names/features in Clerk Dashboard
    const hasProPlan = await has({ plan: "pro" });
    const hasTeamPlan = await has({ plan: "team" });
    const hasFreePlan = await has({ plan: "free" });
    
    // If they have any paid plan, they have an active subscription
    return hasProPlan || hasTeamPlan;
  } catch (error) {
    console.error("Error checking subscription status:", error);
    
    // Fallback: check user metadata (set by webhooks)
    try {
      const user = await currentUser();
      if (!user) {
        return false;
      }

      // Clerk webhooks set subscription status in publicMetadata
      const subscriptionActive = user.publicMetadata?.subscriptionActive as
        | boolean
        | undefined;
      const plan = user.publicMetadata?.plan as string | undefined;

      // Check if they have an active subscription or a paid plan
      return (
        subscriptionActive === true ||
        (plan !== undefined && plan !== "free" && plan !== null)
      );
    } catch (fallbackError) {
      console.error("Fallback subscription check failed:", fallbackError);
      return false;
    }
  }
}

/**
 * Check if user has a specific plan
 * @param planName - Plan name to check (e.g., 'pro', 'team', 'free')
 */
export async function hasPlan(planName: string): Promise<boolean> {
  try {
    const { has } = await auth();
    return await has({ plan: planName });
  } catch (error) {
    console.error(`Error checking plan ${planName}:`, error);
    
    // Fallback: check user metadata
    try {
      const user = await currentUser();
      const plan = user?.publicMetadata?.plan as string | undefined;
      return plan === planName;
    } catch {
      return false;
    }
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
 * Get user's current plan name
 * Returns the plan name or null if no plan found
 */
export async function getUserPlan(): Promise<string | null> {
  try {
    const user = await currentUser();
    if (!user) {
      return null;
    }

    // First try to get from Clerk's subscription data via has()
    const { has } = await auth();
    
    // Check common plans
    if (await has({ plan: "pro" })) return "pro";
    if (await has({ plan: "team" })) return "team";
    if (await has({ plan: "free" })) return "free";

    // Fallback: check metadata (set by webhooks)
    const plan = user.publicMetadata?.plan as string | undefined;
    return plan || null;
  } catch (error) {
    console.error("Error getting user plan:", error);
    return null;
  }
}
