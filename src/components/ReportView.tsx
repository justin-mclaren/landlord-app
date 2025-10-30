"use client";

import type { DecoderReport } from "@/types/report";

interface ReportViewProps {
  report: DecoderReport;
  address: string;
}

export function ReportView({ report, address }: ReportViewProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-black dark:text-white">
            {address}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {report.caption}
          </p>
        </div>

        {/* Scorecard */}
        <div className="mb-12 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 text-center">
            <div className="text-6xl font-bold text-black dark:text-white">
              {report.scorecard.total}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Overall Score
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <ScoreItem
              label="Value"
              score={report.scorecard.value.score}
              rationale={report.scorecard.value.rationale}
            />
            <ScoreItem
              label="Livability"
              score={report.scorecard.livability.score}
              rationale={report.scorecard.livability.rationale}
            />
            <ScoreItem
              label="Noise/Light"
              score={report.scorecard.noise_light.score}
              rationale={report.scorecard.noise_light.rationale}
            />
            <ScoreItem
              label="Hazards"
              score={report.scorecard.hazards.score}
              rationale={report.scorecard.hazards.rationale}
            />
            <ScoreItem
              label="Transparency"
              score={report.scorecard.transparency.score}
              rationale={report.scorecard.transparency.rationale}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-black dark:text-white">
            Summary
          </h2>
          <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.summary}
          </p>
        </div>

        {/* Red Flags */}
        {report.red_flags.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-black dark:text-white">
              Red Flags
            </h2>
            <div className="space-y-4">
              {report.red_flags.map((flag, index) => (
                <div
                  key={index}
                  className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-900/20"
                >
                  <h3 className="mb-2 font-semibold text-red-900 dark:text-red-100">
                    {flag.title}
                  </h3>
                  <p className="text-red-800 dark:text-red-200">
                    {flag.description}
                  </p>
                  {flag.source_field && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      Source: {flag.source_field}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Positives */}
        {report.positives.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-black dark:text-white">
              Positives
            </h2>
            <div className="space-y-4">
              {report.positives.map((positive, index) => (
                <div
                  key={index}
                  className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4 dark:bg-green-900/20"
                >
                  <h3 className="mb-2 font-semibold text-green-900 dark:text-green-100">
                    {positive.title}
                  </h3>
                  <p className="text-green-800 dark:text-green-200">
                    {positive.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up Questions */}
        {report.follow_up_questions.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-black dark:text-white">
              Questions to Ask
            </h2>
            <ul className="space-y-2">
              {report.follow_up_questions.map((question, index) => (
                <li
                  key={index}
                  className="text-lg text-zinc-700 dark:text-zinc-300"
                >
                  • {question}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-zinc-200 pt-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Generated on {new Date(report.generated_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function ScoreItem({
  label,
  score,
  rationale,
}: {
  label: string;
  score: number;
  rationale: string;
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-black dark:text-white">
        {score}
      </div>
      <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-500" title={rationale}>
        {rationale.slice(0, 30)}...
      </div>
    </div>
  );
}

