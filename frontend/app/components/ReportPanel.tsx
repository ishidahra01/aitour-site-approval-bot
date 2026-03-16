"use client";

import React from "react";

interface ReportPanelProps {
  report: string;
}

export default function ReportPanel({ report }: ReportPanelProps) {
  const handleCopy = () => {
    if (report) {
      navigator.clipboard.writeText(report);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-approval-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">📄 Generated Output</span>
          {report && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-300">
              レポート生成済み
            </span>
          )}
        </div>
        {report && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              title="クリップボードにコピー"
            >
              📋 コピー
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              title="テキストファイルとしてダウンロード"
            >
              ⬇️ ダウンロード
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!report ? (
          <EmptyState />
        ) : (
          <ReportContent report={report} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-600">
      <div className="text-5xl mb-4">📋</div>
      <p className="text-base font-medium text-gray-500">承認レポートがここに表示されます</p>
      <p className="text-sm mt-2 text-gray-600">
        エージェントがレポートを生成するとリアルタイムで更新されます
      </p>
      <div className="mt-8 border border-dashed border-gray-700 rounded-lg p-6 max-w-sm text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-500 mb-2">表示内容例:</p>
        <p>📍 Site Approval Report</p>
        <p>🏛️ Municipality Constraints</p>
        <p>📡 RF Design Constraints</p>
        <p>📊 Status</p>
        <p>✅ Recommended Action</p>
      </div>
    </div>
  );
}

function ReportContent({ report }: { report: string }) {
  const lines = report.split("\n");

  return (
    <div className="font-mono text-sm leading-relaxed">
      {lines.map((line, idx) => (
        <ReportLine key={idx} line={line} />
      ))}
    </div>
  );
}

function ReportLine({ line }: { line: string }) {
  // Title line (====)
  if (line.startsWith("=") && line.trim().split("").every((c) => c === "=")) {
    return <div className="border-b border-gray-600 mb-3" />;
  }

  // Dashes separator
  if (line.startsWith("-") && line.trim().split("").every((c) => c === "-")) {
    return <div className="border-b border-gray-700 my-2" />;
  }

  // Section headers (end with -------- on next line — handled above)
  if (
    line.includes("（") ||
    line.match(/^[A-Z][a-zA-Z ]+（/) ||
    line.match(/^[A-Z][a-zA-Z ]+$/)
  ) {
    // Bold section headers
    if (
      line.match(/^(Site Approval|Municipality|RF Design|Status|Recommended|Collected|Summary)/)
    ) {
      return (
        <div className="text-blue-300 font-semibold mt-4 mb-1 text-base">
          {line}
        </div>
      );
    }
  }

  // Report main title
  if (line.trim() === "Site Approval Report") {
    return (
      <div className="text-2xl font-bold text-white mb-1">{line}</div>
    );
  }

  // Status/indicator lines
  const getLineStyle = () => {
    if (line.startsWith("✅")) return "text-green-400";
    if (line.startsWith("⚠️")) return "text-yellow-400";
    if (line.startsWith("❌")) return "text-red-400";
    if (line.startsWith("⏳")) return "text-orange-400";
    if (line.startsWith("🔺")) return "text-red-400 font-medium";
    if (line.startsWith("💴") || line.startsWith("📅") || line.startsWith("👤")) return "text-purple-300";
    if (line.startsWith("📧") || line.startsWith("💬") || line.startsWith("📋") || line.startsWith("📄")) return "text-cyan-400";
    if (line.startsWith("1.") || line.startsWith("2.") || line.startsWith("3.") || line.startsWith("4.")) return "text-white";
    if (line.trim() === "") return "";
    if (line.match(/^[A-Z].*:$/)) return "text-blue-300 font-semibold mt-3";
    return "text-gray-300";
  };

  if (line.trim() === "") {
    return <div className="h-2" />;
  }

  return (
    <div className={`${getLineStyle()} py-0.5`}>
      {line}
    </div>
  );
}
