"use client";

export type PanelContentType = "text" | "html";

interface Props {
  content: string | null;
  contentType: PanelContentType;
  isStreaming: boolean;
}

export default function ApprovalReportPanel({ content, contentType, isStreaming }: Props) {
  if (!content) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8
        bg-gray-50 dark:bg-gray-950">
        <div className="text-5xl mb-4">📋</div>
        <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
          出力パネル
        </h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
          エージェントが Work IQ からコンテキストを収集・分析した後に結果がここに表示されます。
        </p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-3 max-w-xs">
          下のシナリオボタンを押してデモを開始してください。
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
            {isHtml ? "生成コンテンツ" : "Site Approval Report"}
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-blue-500 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              生成中…
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
      <div className="flex-1 overflow-hidden">
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
    </div>
  );
}
