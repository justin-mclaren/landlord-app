/**
 * Quota Tracking System
 * Tracks monthly usage limits per subscription plan
 *
 * Plans:
 * - Trial (7-day): 1 decode total
 * - Basic: 5 decodes/month
 * - Pro: 50 decodes/month
 */

import { kv } from "@vercel/kv";
import { auth } from "@clerk/nextjs/server";

const USAGE_KEY_PREFIX = "usage";
const TRIAL_DECODE_KEY_PREFIX = "trial_decode";

/**
 * Get usage key for a user and month
 * Format: usage:{userId}:{YYYY-MM}
 */
function getUsageKey(userId: string, yearMonth: string): string {
  return `${USAGE_KEY_PREFIX}:${userId}:${yearMonth}`;
}

/**
 * Get trial decode key for a user
 */
function getTrialDecodeKey(userId: string): string {
  return `${TRIAL_DECODE_KEY_PREFIX}:${userId}`;
}

/**
 * Get current year-month string (YYYY-MM)
 */
function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get plan limits
 * Plan names are capitalized: "Basic", "Pro"
 */
function getPlanLimit(plan: string | null): number {
  switch (plan) {
    case "Basic":
      return 5;
    case "Pro":
      return 50;
    default:
      return 0; // No plan = no access
  }
}

/**
 * Check if user is in trial period
 * Clerk handles trial state automatically - check if trial decode hasn't been used
 */
export async function isInTrial(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;

  try {
    // If user has Basic plan but hasn't used trial decode, they're likely in trial
    // Clerk handles trial state, so we check by seeing if they have Basic plan
    // and haven't used their trial decode yet
    const { has } = await auth();
    const hasBasic = await has({ plan: "basic_plan" });

    if (hasBasic) {
      const trialUsed = await hasUsedTrialDecode(userId);
      // If they have Basic plan but haven't used trial decode, they're in trial
      // After trial ends, Clerk auto-renews to active Basic subscription
      return !trialUsed;
    }

    return false;
  } catch (error) {
    console.error("Error checking trial status:", error);
    return false;
  }
}

/**
 * Check if user has used their trial decode
 */
export async function hasUsedTrialDecode(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;

  try {
    const key = getTrialDecodeKey(userId);
    const used = await kv.get<boolean>(key);
    return used === true;
  } catch (error) {
    console.error("Error checking trial decode status:", error);
    return false;
  }
}

/**
 * Mark trial decode as used
 */
export async function markTrialDecodeUsed(
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;

  try {
    const key = getTrialDecodeKey(userId);
    // Store with 7 day TTL (trial period)
    await kv.set(key, true, { ex: 7 * 24 * 60 * 60 });
  } catch (error) {
    console.error("Error marking trial decode as used:", error);
    throw error;
  }
}

/**
 * Get current usage count for user
 * Returns the count for the current month
 */
export async function getCurrentUsage(
  userId: string | null | undefined
): Promise<number> {
  if (!userId) return 0;

  try {
    const yearMonth = getCurrentYearMonth();
    const key = getUsageKey(userId, yearMonth);
    const count = await kv.get<number>(key);
    return count || 0;
  } catch (error) {
    console.error("Error getting current usage:", error);
    return 0;
  }
}

/**
 * Increment usage count for user
 * Returns the new count
 */
export async function incrementUsage(
  userId: string | null | undefined
): Promise<number> {
  if (!userId) {
    throw new Error("Cannot increment usage for anonymous user");
  }

  try {
    const yearMonth = getCurrentYearMonth();
    const key = getUsageKey(userId, yearMonth);
    const newCount = await kv.incr(key);

    // Set expiration to end of month (in case key didn't exist)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const secondsUntilNextMonth = Math.floor(
      (nextMonth.getTime() - now.getTime()) / 1000
    );
    await kv.expire(key, secondsUntilNextMonth);

    return newCount;
  } catch (error) {
    console.error("Error incrementing usage:", error);
    throw error;
  }
}

/**
 * Check if user can decode based on their plan and usage
 * Returns { allowed: boolean, reason?: string, remaining?: number }
 */
export async function canDecode(
  userId: string | null | undefined,
  plan: string | null
): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
}> {
  if (!userId) {
    return {
      allowed: false,
      reason: "Authentication required",
    };
  }

  // Check if user is in trial (has Basic plan but hasn't used trial decode)
  const inTrial = await isInTrial(userId);

  if (inTrial) {
    const trialDecodeUsed = await hasUsedTrialDecode(userId);
    if (trialDecodeUsed) {
      return {
        allowed: false,
        reason: "Trial decode already used. Upgrade to continue.",
        remaining: 0,
        limit: 1,
      };
    }
    return {
      allowed: true,
      remaining: 1,
      limit: 1,
    };
  }

  // Check plan limits
  const limit = getPlanLimit(plan);
  if (limit === 0) {
    return {
      allowed: false,
      reason: "No active subscription. Please subscribe to continue.",
      remaining: 0,
      limit: 0,
    };
  }

  // Check monthly usage
  const currentUsage = await getCurrentUsage(userId);
  const remaining = Math.max(0, limit - currentUsage);

  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${limit} decodes). Plan renews monthly.`,
      remaining: 0,
      limit,
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
  };
}

/**
 * Reset usage for a user (useful for testing or manual resets)
 */
export async function resetUsage(
  userId: string,
  yearMonth?: string
): Promise<void> {
  const month = yearMonth || getCurrentYearMonth();
  const key = getUsageKey(userId, month);
  await kv.del(key);
}

// Legacy function for backward compatibility (deprecated)
export async function hasUsedFreeCheck(
  userId: string | null | undefined
): Promise<boolean> {
  // This is now replaced by trial/plan logic
  // Keep for backward compatibility
  const { getUserPlan } = await import("@/lib/entitlements");
  const plan = await getUserPlan();
  const inTrial = await isInTrial(userId);

  if (inTrial) {
    return await hasUsedTrialDecode(userId);
  }

  // If no plan, they've "used" their free check
  return !plan || plan === "free";
}

// Legacy function for backward compatibility (deprecated)
export async function markFreeCheckUsed(
  userId: string | null | undefined
): Promise<void> {
  // This is now replaced by trial/plan logic
  // Keep for backward compatibility
  const inTrial = await isInTrial(userId);
  if (inTrial) {
    await markTrialDecodeUsed(userId);
  }
}
