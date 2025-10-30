/**
 * POST /api/decode
 * Main decode endpoint - starts the decode workflow
 */
import { NextResponse } from "next/server";
import { executeDecodeFlowSafe } from "@/flows/decode";
import type { DecodeFlowInput } from "@/types/workflow";

export async function POST(request: Request) {
  try {
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

    return NextResponse.json({
      status: "ok",
      url: result.reportUrl,
    });
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

