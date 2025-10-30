/**
 * Status endpoint
 * GET /api/status/:jobId
 * Returns workflow status for async jobs
 * 
 * Note: For MVP with synchronous execution, this is a placeholder.
 * In production with async workflows, this would track job progress.
 */
import { NextResponse } from "next/server";
import type { WorkflowStatus } from "@/types/workflow";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // TODO: In production with async workflows:
    // 1. Look up job status in database/KV
    // 2. Return current progress
    
    // For MVP placeholder, return not found
    return NextResponse.json(
      {
        status: "not_found",
        error: "Job not found. MVP uses synchronous execution.",
      },
      { status: 404 }
    );

    // TODO: Once async workflows are implemented:
    // const jobStatus = await getJobStatus(jobId);
    // if (!jobStatus) {
    //   return NextResponse.json(
    //     { status: "not_found" },
    //     { status: 404 }
    //   );
    // }
    // 
    // return NextResponse.json(jobStatus);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

