"use client";

import { useId, useState } from "react";
import { ToolExecution } from "@/app/lib/types";
import { extractUrls } from "@/app/lib/utils";

/** Work IQ gradient icon (approximates the Microsoft Copilot / Work IQ icon). */
function WorkIQIcon({ className = "w-4 h-4" }: { className?: string }) {
  const uid = useId();
  const g1 = `wiq-a-${uid}`;
  const g2 = `wiq-b-${uid}`;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={g1} x1="2" y1="2" x2="13" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18BFEF" />
          <stop offset="1" stopColor="#5C62D6" />
        </linearGradient>
        <linearGradient id={g2} x1="11" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8A2BE2" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      {/* Upper-left petal (blue → purple) */}
      <path
        d="M12 12C12 12 5.5 11.5 4.5 7.5C3.5 3.5 6.5 1.5 9.5 2.5C12.5 3.5 13 7 12 12Z"
        fill={`url(#${g1})`}
      />
      {/* Lower-right petal (purple → pink) */}
      <path
        d="M12 12C12 12 18.5 12.5 19.5 16.5C20.5 20.5 17.5 22.5 14.5 21.5C11.5 20.5 11 17 12 12Z"
        fill={`url(#${g2})`}
      />
    </svg>
  );
}

/** Badge shown in the Work IQ tool card header. */
function WorkIQBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0 text-xs font-semibold
      bg-gradient-to-r from-cyan-50 to-purple-50
      dark:from-cyan-900/20 dark:to-purple-900/20
      border border-purple-200 dark:border-purple-700/50
      text-purple-700 dark:text-purple-300
      px-1.5 py-0.5 rounded"
    >
      <WorkIQIcon className="w-3 h-3" />
      Work IQ
    </span>
  );
}

function getToolLabel(toolName: string): string {
  if (toolName === "generate_powerpoint_tool") {
    return "PowerPoint Generator";
  }
  if (toolName.toLowerCase().includes("workiq")) {
    // Show only the portion after the last underscore for brevity
    const shortName = toolName.replace(/workiq[_-]?/i, "");
    return shortName ? shortName : toolName;
  }
  return toolName;
}

interface Props {
  execution: ToolExecution;
}

export default function ToolExecutionCard({ execution }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isWorkIQ = execution.toolName.toLowerCase().includes("workiq");
  const label = getToolLabel(execution.toolName);

  const isRunning = execution.status === "running";
  const duration =
    execution.completedAt && execution.startedAt
      ? ((execution.completedAt - execution.startedAt) / 1000).toFixed(1)
      : null;

  // Check if result contains a PowerPoint download link
  const pptxMatch = execution.result?.match(/GET \/reports\/(\S+\.pptx)/);

  // Extract source URLs from Work IQ results
  const sourceUrls =
    isWorkIQ && execution.result ? extractUrls(execution.result) : [];

  return (
    <div
      className={`my-2 rounded-lg overflow-hidden text-sm
        ${isWorkIQ
          ? "border border-purple-200 dark:border-purple-800/60"
          : "border border-gray-200 dark:border-gray-700"
        }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-3 py-2
          transition-colors text-left
          ${isWorkIQ
            ? "bg-gradient-to-r from-cyan-50/70 to-purple-50/70 dark:from-cyan-900/10 dark:to-purple-900/10 hover:from-cyan-100/80 hover:to-purple-100/80 dark:hover:from-cyan-900/20 dark:hover:to-purple-900/20"
            : "bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60"
          }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isWorkIQ ? (
            <>
              <WorkIQBadge />
              <span className="font-medium text-purple-800 dark:text-purple-200 truncate text-xs">
                {label}
              </span>
            </>
          ) : (
            <>
              <span>{execution.toolName === "generate_powerpoint_tool" ? "📊" : "🔧"}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                {label}
              </span>
            </>
          )}

          {isRunning && (
            <span className="flex items-center gap-1 text-blue-500 text-xs animate-pulse shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              Running…
            </span>
          )}
          {!isRunning && duration && (
            <span className="text-xs text-gray-400 shrink-0">{duration}s</span>
          )}
          {/* Source count badge (collapsed) */}
          {!expanded && sourceUrls.length > 0 && (
            <span
              className="shrink-0 text-xs px-1.5 py-0.5 rounded-full
              bg-purple-100 dark:bg-purple-900/40
              text-purple-600 dark:text-purple-300
              border border-purple-200 dark:border-purple-700"
            >
              {sourceUrls.length} source{sourceUrls.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs shrink-0 ml-2">
          {expanded ? "▲ hide" : "▼ show"}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-2 space-y-2 bg-white dark:bg-gray-900/40">
          {execution.args && Object.keys(execution.args).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Arguments
              </p>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(execution.args, null, 2)}
              </pre>
            </div>
          )}

          {execution.result && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Result
              </p>
              <div className="text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {execution.result}
              </div>

              {/* Work IQ source links */}
              {sourceUrls.length > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1.5 flex items-center gap-1">
                    <WorkIQIcon className="w-3.5 h-3.5" />
                    Work IQ Sources
                  </p>
                  <ul className="space-y-1">
                    {sourceUrls.map((url, i) => (
                      <li key={i}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pptxMatch && (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/reports/${pptxMatch[1]}`}
                  download
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                >
                  📥 Download PowerPoint
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
