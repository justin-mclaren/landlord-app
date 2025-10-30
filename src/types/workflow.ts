/**
 * Workflow input/output types
 */

export type DecoderPrefs = {
  workAddress?: string;
  // Future: other preferences
};

export type DecodeFlowInput = {
  url?: string;
  address?: string;
  prefs?: DecoderPrefs;
};

export type DecodeFlowOutput = {
  reportUrl: string;
  slug: string;
  jobId?: string; // For async workflows
};

export type WorkflowStatus = {
  status: "queued" | "processing" | "complete" | "error";
  step?: string;
  progress?: number; // 0-1
  error?: string;
};

