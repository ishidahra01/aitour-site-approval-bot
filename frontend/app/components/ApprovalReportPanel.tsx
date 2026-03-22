"use client";

import { useId } from "react";

export type PanelContentType = "text" | "html";

export interface WorkIQSource {
  toolName: string;
  urls: string[];
}

interface Props {
  content: string | null;
  contentType: PanelContentType;
  isStreaming: boolean;
  workiqSources?: WorkIQSource[];
}

/** Work IQ gradient icon for panel header/footer. */
function WorkIQIcon({ className = "w-4 h-4" }: { className?: string }) {
  const uid = useId();
  const g1 = `panel-wiq-a-${uid}`;
  const g2 = `panel-wiq-b-${uid}`;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
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
      <path d="M12 12C12 12 5.5 11.5 4.5 7.5C3.5 3.5 6.5 1.5 9.5 2.5C12.5 3.5 13 7 12 12Z" fill={`url(#${g1})`} />
      <path d="M12 12C12 12 18.5 12.5 19.5 16.5C20.5 20.5 17.5 22.5 14.5 21.5C11.5 20.5 11 17 12 12Z" fill={`url(#${g2})`} />
    </svg>
  );
}

/** Source links footer shown at the bottom of the panel. */
function WorkIQSourcesFooter({ sources }: { sources: WorkIQSource[] }) {
  const allUrls = [...new Set(sources.flatMap((s) => s.urls))];
  if (allUrls.length === 0) return null;

  return (
    <div
      className="shrink-0 border-t border-purple-200 dark:border-purple-800/50
        bg-gradient-to-r from-cyan-50/60 to-purple-50/60
        dark:from-cyan-900/10 dark:to-purple-900/10
        px-4 py-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
        <WorkIQIcon className="w-4 h-4" />
        Work IQ Sources
        <span className="font-normal text-purple-400 dark:text-purple-500">
          ({allUrls.length})
        </span>
      </p>
      <ul className="space-y-1">
        {allUrls.map((url, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs">
            <span className="text-purple-400 dark:text-purple-500 shrink-0 tabular-nums mt-px">
              {i + 1}.
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ApprovalReportPanel({
  content,
  contentType,
  isStreaming,
  workiqSources,
}: Props) {
  const allSourceUrls = workiqSources?.flatMap((s) => s.urls) ?? [];
  const hasSources = allSourceUrls.length > 0;

  if (!content) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8
        bg-gray-50 dark:bg-gray-950">
        <div className="mb-4">
          <WorkIQIcon className="w-12 h-12 mx-auto" />
        </div>
        <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
          出力パネル
        </h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
          エージェントが Work IQ からコンテキストを収集・分析した後に結果がここに表示されます。
        </p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-3 max-w-xs">
          下のPJ支援タスクを選ぶか、自由入力で依頼してください。
        </p>
      </div>
    );
  }

  const isHtml = contentType === "html";

  const handleDownload = () => {
    const blob = new Blob([content], {
      type: isHtml ? "text/html" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isHtml ? "output.html" : "site-approval-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* Panel header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{isHtml ? "🖥️" : "📋"}</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {isHtml ? "PJ支援コンテンツ" : "承認レポート"}
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-blue-500 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              生成中…
            </span>
          )}
          {/* Inline source count badge in header */}
          {hasSources && !isStreaming && (
            <span
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full
                bg-purple-50 dark:bg-purple-900/30
                border border-purple-200 dark:border-purple-700/50
                text-purple-600 dark:text-purple-300"
            >
              <WorkIQIcon className="w-3 h-3" />
              {allSourceUrls.length} sources
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          title="ダウンロード"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          ⬇ Download
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {isHtml ? (
          isStreaming ? (
            <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-2 text-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                HTMLコンテンツを生成中…
              </span>
            </div>
          ) : (
            <iframe
              srcDoc={content}
              sandbox="allow-scripts allow-forms"
              className="w-full h-full border-none"
              title="生成コンテンツ"
            />
          )
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <pre className="text-xs font-mono text-gray-800 dark:text-gray-200
              whitespace-pre-wrap break-words leading-relaxed">
              {content}
            </pre>
          </div>
        )}
      </div>

      {/* Work IQ Sources footer */}
      {hasSources && !isStreaming && (
        <WorkIQSourcesFooter sources={workiqSources!} />
      )}
    </div>
  );
}
