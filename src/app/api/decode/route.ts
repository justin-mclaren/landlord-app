/**
 * POST /api/decode
 * Main decode endpoint - starts the decode workflow
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { executeDecodeFlowSafe } from "@/flows/decode";
import type { DecodeFlowInput } from "@/types/workflow";
import {
  ValidationError,
  normalizeError,
  getStatusCode,
  getUserMessage,
  getErrorCode,
} from "@/lib/errors";
import { hasQuotaRemaining, getRemainingQuota, consumeDecode } from "@/lib/quotas";
import { getPlanFeatures } from "@/lib/entitlements";

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

    // Check quota (for authenticated users)
    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const planName = user?.publicMetadata?.plan as string | undefined;

    const quotaRemaining = await hasQuotaRemaining(userId || null, planName);
    if (!quotaRemaining) {
      const features = getPlanFeatures(planName);
      const remaining = await getRemainingQuota(userId || null, planName);
      throw new ValidationError(
        `You've reached your monthly limit of ${features.maxDecodesPerMonth} decodes. Please upgrade your plan or wait until next month.`,
        "quota",
        {
          remaining,
          maxDecodes: features.maxDecodesPerMonth,
          plan: planName || "free",
        }
      );
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

    // Consume quota after successful decode
    if (userId) {
      try {
        await consumeDecode(userId);
      } catch (error) {
        console.error("Failed to consume quota (non-blocking):", error);
        // Don't fail the request if quota tracking fails
      }
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
