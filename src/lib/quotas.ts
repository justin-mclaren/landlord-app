/**
 * Usage Quotas Tracking
 * Tracks decode usage per user per month using Vercel KV
 */

import { kv } from "@vercel/kv";
import { getMaxDecodesPerMonth } from "./entitlements";

const USAGE_KEY_PREFIX = "usage";

/**
 * Get usage key for a user in a given month
 */
function getUsageKey(userId: string, year: number, month: number): string {
  const monthStr = String(month).padStart(2, "0");
  return `${USAGE_KEY_PREFIX}:${userId}:${year}-${monthStr}`;
}

/**
 * Get current month's usage key
 */
function getCurrentUsageKey(userId: string): string {
  const now = new Date();
  return getUsageKey(userId, now.getUTCFullYear(), now.getUTCMonth() + 1);
}

/**
 * Get current usage count for a user
 */
export async function getCurrentUsage(userId: string | null | undefined): Promise<number> {
  if (!userId) {
    return 0;
  }

  try {
    const key = getCurrentUsageKey(userId);
    const usage = await kv.get<number>(key);
    return usage || 0;
  } catch (error) {
    console.error("Error getting usage:", error);
    return 0;
  }
}

/**
 * Increment usage count for a user (consumes 1 decode)
 */
export async function consumeDecode(userId: string | null | undefined): Promise<void> {
  if (!userId) {
    return;
  }

  try {
    const key = getCurrentUsageKey(userId);
    // Increment atomically - defaults to 0 if key doesn't exist
    await kv.incr(key);
  } catch (error) {
    console.error("Error consuming decode:", error);
    throw error;
  }
}

/**
 * Check if user has remaining quota
 */
export async function hasQuotaRemaining(
  userId: string | null | undefined,
  planName: string | null | undefined
): Promise<boolean> {
  if (!userId) {
    // Anonymous users: treat as free plan
    const maxDecodes = getMaxDecodesPerMonth(null);
    const usage = await getCurrentUsage(userId);
    return usage < maxDecodes;
  }

  const maxDecodes = getMaxDecodesPerMonth(planName);
  const usage = await getCurrentUsage(userId);
  return usage < maxDecodes;
}

/**
 * Get remaining quota for a user
 */
export async function getRemainingQuota(
  userId: string | null | undefined,
  planName: string | null | undefined
): Promise<number> {
  const maxDecodes = getMaxDecodesPerMonth(planName);
  const usage = await getCurrentUsage(userId);
  return Math.max(0, maxDecodes - usage);
}

/**
 * Reset usage for a user (called at cycle boundaries)
 */
export async function resetUsage(userId: string, year: number, month: number): Promise<void> {
  try {
    const key = getUsageKey(userId, year, month);
    await kv.del(key);
  } catch (error) {
    console.error("Error resetting usage:", error);
    throw error;
  }
}

