/**
 * POST /api/decode
 * Main decode endpoint - starts the decode workflow
 */
import { NextResponse } from "next/server";
import { executeDecodeFlowSafe } from "@/flows/decode";
import { checkDecodeRateLimit } from "@/lib/rate-limit";
import type { DecodeFlowInput } from "@/types/workflow";

export async function POST(request: Request) {
  try {
    // Check rate limit (before processing to save resources)
    const rateLimit = await checkDecodeRateLimit(undefined, request.headers);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: rateLimit.retryAfter,
          reset: rateLimit.reset,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.reset.toString(),
            "Retry-After": rateLimit.retryAfter?.toString() || "3600",
          },
        }
      );
    }

    const body: DecodeFlowInput = await request.json();
    
    // Validate input
    if (!body.url && !body.address) {
      return NextResponse.json(
        { error: "Either url or address must be provided" },
        { status: 400 }
      );
    }

    // Execute decode flow
    const result = await executeDecodeFlowSafe(body, (progress) => {
      // For MVP, we're doing synchronous execution
      // In production with async workflows, you'd store progress and return jobId
      console.log(`Decode progress: ${progress.step} (${(progress.progress * 100).toFixed(0)}%)`);
    });

    return NextResponse.json(
      {
        status: "ok",
        url: result.reportUrl,
      },
      {
        headers: {
          "X-RateLimit-Limit": rateLimit.limit.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": rateLimit.reset.toString(),
        },
      }
    );
  } catch (error) {
    console.error("Decode error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

