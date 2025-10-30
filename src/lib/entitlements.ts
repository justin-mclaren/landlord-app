/**
 * Subscription Status Check
 * Simple helper to check if user has an active subscription via Clerk
 */

import { currentUser } from "@clerk/nextjs/server";

/**
 * Check if user has an active subscription
 * Clerk Billing stores subscription status in user metadata
 */
export async function hasActiveSubscription(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const user = await currentUser();
    if (!user) {
      return false;
    }

    // Clerk Billing stores subscription status in publicMetadata
    // Check for active subscription indicator
    // This should be set by Clerk webhooks when subscription is active
    const subscriptionActive = user.publicMetadata?.subscriptionActive as
      | boolean
      | undefined;

    // Also check if they have a subscription plan set
    const hasPlan = !!user.publicMetadata?.plan;

    return subscriptionActive === true || hasPlan;
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return false; // Default to false on error
  }
}
