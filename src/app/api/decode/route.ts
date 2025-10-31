/**
 * POST /api/decode
 * Main decode endpoint - starts the decode workflow
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeDecodeFlowSafe } from "@/flows/decode";
import type { DecodeFlowInput } from "@/types/workflow";
import {
  ValidationError,
  normalizeError,
  getStatusCode,
  getUserMessage,
  getErrorCode,
} from "@/lib/errors";
import { canDecode, incrementUsage } from "@/lib/quotas";
import { getUserPlan } from "@/lib/entitlements";

export async function POST(request: Request) {
  try {
    let body: DecodeFlowInput;

    // Parse and validate request body
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", "body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    // Validate input
    if (!body.url && !body.address) {
      throw new ValidationError(
        "Either url or address must be provided",
        "input"
      );
    }

    // Validate address format if provided
    if (body.address && typeof body.address !== "string") {
      throw new ValidationError("Address must be a string", "address");
    }

    // Validate URL format if provided
    if (body.url) {
      if (typeof body.url !== "string") {
        throw new ValidationError("URL must be a string", "url");
      }
      try {
        new URL(body.url);
      } catch {
        throw new ValidationError("Invalid URL format", "url");
      }
    }

    // Check freemium access - requires authentication
    const { userId } = await auth();

    if (!userId) {
      throw new ValidationError(
        "Please sign in to decode listings. Try 1 free decode with a 7-day trial!",
        "authentication_required",
        {
          upgradeUrl: "/pricing",
        }
      );
    }

    // Get user's plan (Clerk handles subscription status automatically)
    const plan = await getUserPlan();

    // Check if user can decode based on plan and usage
    const quotaCheck = await canDecode(userId, plan);

    if (!quotaCheck.allowed) {
      // Determine error message based on reason
      let errorMessage = quotaCheck.reason || "Subscription required";
      let errorCode = "subscription_required";

      if (quotaCheck.reason?.includes("Trial decode")) {
        errorMessage =
          "Your trial decode has been used. Upgrade to Basic ($5/month) or Pro ($9/month) to continue decoding listings.";
        errorCode = "trial_expired";
      } else if (quotaCheck.reason?.includes("Monthly limit")) {
        errorMessage = `You've reached your monthly limit of ${quotaCheck.limit} decodes. Upgrade to Pro for 50 decodes/month, or wait for your plan to renew.`;
        errorCode = "quota_exceeded";
      } else if (quotaCheck.reason?.includes("No active subscription")) {
        errorMessage =
          "Subscribe to Basic ($5/month, 5 decodes) or Pro ($9/month, 50 decodes) to continue decoding listings.";
        errorCode = "subscription_required";
      }

      throw new ValidationError(errorMessage, errorCode, {
        upgradeUrl: "/pricing",
        remaining: quotaCheck.remaining,
        limit: quotaCheck.limit,
      });
    }

    // Execute decode flow
    const result = await executeDecodeFlowSafe(body, (progress) => {
      // For MVP, we're doing synchronous execution
      // In production with async workflows, you'd store progress and return jobId
      console.log(
        `Decode progress: ${progress.step} (${(progress.progress * 100).toFixed(
          0
        )}%)`
      );
    });

    // Track usage after successful decode
    // userId is guaranteed to exist here due to auth check above
    try {
      // Check if user is in trial
      const { isInTrial, hasUsedTrialDecode, markTrialDecodeUsed } =
        await import("@/lib/quotas");
      const inTrial = await isInTrial(userId);

      if (inTrial) {
        // Mark trial decode as used
        const trialUsed = await hasUsedTrialDecode(userId);
        if (!trialUsed) {
          await markTrialDecodeUsed(userId);
        }
      } else {
        // Otherwise, increment monthly usage
        await incrementUsage(userId);
      }
    } catch (error) {
      console.error("Failed to track usage (non-blocking):", error);
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({
      status: "ok",
      url: result.reportUrl,
    });
  } catch (error) {
    const normalizedError = normalizeError(error);
    const statusCode = getStatusCode(normalizedError);
    const errorCode = getErrorCode(normalizedError);
    const userMessage = getUserMessage(normalizedError);

    // Log error with context
    console.error("Decode error:", {
      code: errorCode,
      message: normalizedError.message,
      statusCode,
      context: normalizedError.context,
      stack: normalizedError.stack,
    });

    // Return structured error response
    return NextResponse.json(
      {
        error: userMessage,
        code: errorCode,
        ...(normalizedError.context && { context: normalizedError.context }),
      },
      { status: statusCode }
    );
  }
}
