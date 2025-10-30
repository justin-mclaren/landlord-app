/**
 * Entitlements & Feature Gating
 * Maps Clerk subscription plans to features and usage limits
 */

export type Plan = "free" | "pro" | "team";

export interface PlanFeatures {
  plan: Plan;
  maxDecodesPerMonth: number;
  watermark: boolean;
  batchDecode: boolean;
  priorityQueue: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    plan: "free",
    maxDecodesPerMonth: 5,
    watermark: true,
    batchDecode: false,
    priorityQueue: false,
  },
  pro: {
    plan: "pro",
    maxDecodesPerMonth: 200,
    watermark: false,
    batchDecode: true,
    priorityQueue: true,
  },
  team: {
    plan: "team",
    maxDecodesPerMonth: 1000, // Per seat
    watermark: false,
    batchDecode: true,
    priorityQueue: true,
  },
};

/**
 * Get plan features for a given plan name
 */
export function getPlanFeatures(planName: string | null | undefined): PlanFeatures {
  const normalizedPlan = planName?.toLowerCase() as Plan;
  return PLAN_FEATURES[normalizedPlan] || PLAN_FEATURES.free;
}

/**
 * Check if user has a specific feature
 */
export function hasFeature(
  planName: string | null | undefined,
  feature: keyof Omit<PlanFeatures, "plan" | "maxDecodesPerMonth">
): boolean {
  const features = getPlanFeatures(planName);
  return features[feature];
}

/**
 * Get maximum decodes per month for a plan
 */
export function getMaxDecodesPerMonth(planName: string | null | undefined): number {
  const features = getPlanFeatures(planName);
  return features.maxDecodesPerMonth;
}

