/**
 * POST /api/decode
 * Main decode endpoint - starts the decode workflow
 */
import { NextResponse } from "next/server";
import { executeDecodeFlowSafe } from "@/flows/decode";
import type { DecodeFlowInput } from "@/types/workflow";
import {
  ValidationError,
  normalizeError,
  getStatusCode,
  getUserMessage,
  getErrorCode,
} from "@/lib/errors";

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
