"use client";

import { useState } from "react";
import { AgentEvent } from "@/app/lib/types";

// Friendly labels for common Copilot SDK event names
const EVENT_LABELS: Record<string, string> = {
  "run.start": "実行開始",
  "run.complete": "実行完了",
  "run.error": "エラー発生",
  "skill.loaded": "スキル読み込み",
  "skill.call": "スキル呼び出し",
  "tool.call": "ツール呼び出し",
  "tool.result": "ツール結果受信",
  "context.added": "コンテキスト追加",
  "session.turn.start": "ターン開始",
  "session.turn.end": "ターン完了",
};

function getEventStatus(
  eventName: string
): "success" | "error" | "pending" | "info" {
  const lower = eventName.toLowerCase();
  if (lower.includes("error") || lower.includes("fail")) return "error";
  if (
    lower.includes("complete") ||
    lower.includes("end") ||
    lower.includes("done")
  )
    return "success";
  if (lower.includes("start") || lower.includes("begin")) return "pending";
  return "info";
}

const STATUS_STYLES = {
  success: {
    icon: "✓",
    dotClass: "bg-green-400",
    textClass: "text-green-600 dark:text-green-400",
  },
  error: {
    icon: "✕",
    dotClass: "bg-red-400",
    textClass: "text-red-500 dark:text-red-400",
  },
  pending: {
    icon: "→",
    dotClass: "bg-blue-400 animate-pulse",
    textClass: "text-blue-500 dark:text-blue-400",
  },
  info: {
    icon: "●",
    dotClass: "bg-gray-400",
    textClass: "text-gray-500 dark:text-gray-400",
  },
};

function EventRow({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const status = getEventStatus(event.eventName);
  const style = STATUS_STYLES[status];
  const friendlyLabel = EVENT_LABELS[event.eventName];
  const hasData = !!event.data && Object.keys(event.data).length > 0;

  return (
    <div className="text-xs">
      <button
        onClick={() => hasData && setOpen(!open)}
        disabled={!hasData}
        className={`w-full flex items-center gap-2 px-3 py-1 text-left transition-colors
          ${hasData ? "hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer" : "cursor-default"}`}
      >
        {/* Status icon */}
        <span className={`shrink-0 w-3 font-mono font-bold ${style.textClass}`}>
          {style.icon}
        </span>

        {/* Event name in monospace */}
        <span className="font-mono text-gray-600 dark:text-gray-300 truncate">
          {event.eventName}
        </span>

        {/* Friendly label */}
        {friendlyLabel && (
          <span className="text-gray-400 dark:text-gray-600 shrink-0 hidden sm:inline">
            — {friendlyLabel}
          </span>
        )}

        {/* Timestamp */}
        <span className="ml-auto text-gray-300 dark:text-gray-600 shrink-0 tabular-nums">
          {new Date(event.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>

        {/* Expand indicator */}
        {hasData && (
          <span className="text-gray-300 dark:text-gray-600 shrink-0">
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>

      {/* Expanded data */}
      {open && hasData && (
        <div className="mx-3 mb-1 border-l-2 border-gray-200 dark:border-gray-700 pl-3 mt-0.5">
          <pre
            className="text-xs font-mono text-gray-600 dark:text-gray-400
            whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900/60
            rounded p-2 overflow-auto max-h-48"
          >
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function GitHubCopilotBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0 text-xs font-semibold
      text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30
      border border-purple-200 dark:border-purple-700/50 px-1.5 py-0.5 rounded"
    >
      {/* Copilot logo icon */}
      <svg
        viewBox="0 0 16 16"
        className="w-3 h-3"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M4 3h8v9H4V3zm8-1H4C3.45 2 3 2.45 3 3v9c0 .55.45 1 1 1h3.5l1 1.5h-.75a.25.25 0 0 0 0 .5h2.5a.25.25 0 0 0 0-.5h-.75l1-1.5H12c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-2 4.5a1 1 0 1 1-2.001.001A1 1 0 0 1 10 6.5zm-4 0a1 1 0 1 1-2.001.001A1 1 0 0 1 6 6.5z" />
      </svg>
      GitHub Copilot
    </span>
  );
}

interface Props {
  events: AgentEvent[];
}

/**
 * AgentLogPanel renders all Copilot SDK events for a message as a
 * collapsible, GitHub Copilot-style activity log.
 */
export default function AgentLogPanel({ events }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  if (events.length === 0) return null;

  // Count events by status for the summary
  const successCount = events.filter(
    (e) => getEventStatus(e.eventName) === "success"
  ).length;
  const errorCount = events.filter(
    (e) => getEventStatus(e.eventName) === "error"
  ).length;

  return (
    <div className="mb-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm w-full">
      {/* Panel header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2
          bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60
          transition-colors text-left"
      >
        <GitHubCopilotBadge />

        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          Activity Log
        </span>

        {/* Step count badges */}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {events.length} steps
        </span>

        {errorCount > 0 && (
          <span className="text-xs text-red-500 font-medium">
            {errorCount} error{errorCount > 1 ? "s" : ""}
          </span>
        )}
        {successCount > 0 && errorCount === 0 && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            {successCount} completed
          </span>
        )}

        <span className="ml-auto text-gray-400 text-xs">
          {collapsed ? "▼ show" : "▲ hide"}
        </span>
      </button>

      {/* Log entries */}
      {!collapsed && (
        <div className="bg-white dark:bg-gray-900/40 divide-y divide-gray-100 dark:divide-gray-800/60">
          {/* Column header */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
            <span className="w-3 shrink-0" />
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Event
            </span>
            <span className="ml-auto text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Time
            </span>
          </div>

          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
