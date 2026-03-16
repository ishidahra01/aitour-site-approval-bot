"use client";

import { useState } from "react";
import ChatPanel from "./components/ChatPanel";
import ReportPanel from "./components/ReportPanel";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/chat";

export default function Home() {
  const [report, setReport] = useState<string>("");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Left pane: Chat UI */}
      <div className="flex-1 min-w-0 border-r border-gray-800">
        <ChatPanel onReportUpdate={setReport} wsUrl={WS_URL} />
      </div>

      {/* Right pane: Generated Output / Report */}
      <div className="flex-1 min-w-0">
        <ReportPanel report={report} />
      </div>
    </div>
  );
}
