/**
 * Free Check Tracking
 * Tracks if a user has used their one free listing check
 */

import { kv } from "@vercel/kv";

const FREE_CHECK_KEY_PREFIX = "free_check";

/**
 * Get free check key for a user
 */
function getFreeCheckKey(userId: string): string {
  return `${FREE_CHECK_KEY_PREFIX}:${userId}`;
}

/**
 * Check if user has used their free check
 */
export async function hasUsedFreeCheck(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) {
    return false; // Anonymous users haven't used free check
  }

  try {
    const key = getFreeCheckKey(userId);
    const used = await kv.get<boolean>(key);
    return used === true;
  } catch (error) {
    console.error("Error checking free check status:", error);
    return false; // Default to allowing if we can't check
  }
}

/**
 * Mark free check as used
 */
export async function markFreeCheckUsed(
  userId: string | null | undefined
): Promise<void> {
  if (!userId) {
    return;
  }

  try {
    const key = getFreeCheckKey(userId);
    await kv.set(key, true);
  } catch (error) {
    console.error("Error marking free check as used:", error);
    throw error;
  }
}
