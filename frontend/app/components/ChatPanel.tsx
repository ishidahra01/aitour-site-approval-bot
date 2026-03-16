"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// How long (ms) the municipality email notification stays visible
const NOTIFICATION_TIMEOUT_MS = 8000;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ToolCallInfo {
  tool_name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

interface ChatPanelProps {
  onReportUpdate: (report: string) => void;
  wsUrl: string;
}

export default function ChatPanel({ onReportUpdate, wsUrl }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAssistantMsgRef = useRef<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls]);

  // WebSocket connection
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleAgentEvent(data);
      };
    };

    connect();
    return () => {
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  const handleAgentEvent = useCallback(
    (event: Record<string, unknown>) => {
      switch (event.type) {
        case "text_delta": {
          const delta = (event.content as string) || "";
          currentAssistantMsgRef.current += delta; // Accumulate raw text

          // Compute display content from raw accumulated text (strip report markers)
          const rawAccumulated = currentAssistantMsgRef.current;
          const displayContent = rawAccumulated
            .replace(/REPORT_START\n?[\s\S]*?(\nREPORT_END|REPORT_END)/g, "")
            .replace(/REPORT_START[\s\S]*/g, ""); // Strip incomplete marker at end

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: displayContent },
              ];
            } else {
              return [...prev, { role: "assistant", content: displayContent }];
            }
          });
          break;
        }

        case "tool_call": {
          const toolName = (event.tool_name as string) || "";
          const args = (event.arguments as Record<string, unknown>) || {};
          setToolCalls((prev) => [...prev, { tool_name: toolName, arguments: args }]);
          break;
        }

        case "tool_result": {
          const toolName = (event.tool_name as string) || "";
          const result = (event.result as string) || "";
          setToolCalls((prev) => {
            const updated = [...prev];
            const lastIdx = updated.map((t) => t.tool_name).lastIndexOf(toolName);
            if (lastIdx >= 0) {
              updated[lastIdx] = { ...updated[lastIdx], result };
            }
            return updated;
          });
          break;
        }

        case "report_update": {
          const report = (event.content as string) || "";
          onReportUpdate(report);
          break;
        }

        case "done": {
          setIsThinking(false);
          currentAssistantMsgRef.current = "";
          break;
        }

        case "error": {
          const errMsg = (event.content as string) || "Unknown error";
          setMessages((prev) => [
            ...prev,
            { role: "system", content: `❌ エラー: ${errMsg}` },
          ]);
          setIsThinking(false);
          break;
        }
      }
    },
    [onReportUpdate]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      const userMessage: Message = { role: "user", content };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsThinking(true);
      setToolCalls([]);
      currentAssistantMsgRef.current = "";

      // Build history (exclude current message)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      wsRef.current.send(
        JSON.stringify({
          type: "message",
          content,
          history,
        })
      );
    },
    [messages]
  );

  const triggerMunicipalityEmail = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/api/trigger", {
        method: "POST",
      });
      const data = await res.json();

      setNotification(data.message);
      setTimeout(() => setNotification(null), NOTIFICATION_TIMEOUT_MS);

      // Auto-send the suggested prompt
      if (data.suggested_prompt) {
        setTimeout(() => {
          sendMessage(data.suggested_prompt);
        }, 1000);
      }
    } catch {
      setNotification("⚠️ バックエンドに接続できません。バックエンドが起動しているか確認してください。");
      setTimeout(() => setNotification(null), 5000);
    }
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setToolCalls([]);
    setIsThinking(false);
    currentAssistantMsgRef.current = "";
    onReportUpdate("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">🏗️ Site Approval Bot</span>
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
            title={isConnected ? "接続済み" : "接続中..."}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerMunicipalityEmail}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            📧 許可メール到着
          </button>
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            ➕ 新しい会話
          </button>
        </div>
      </div>

      {/* Municipality email notification */}
      {notification && (
        <div className="mx-4 mt-3 p-3 bg-blue-900 border border-blue-600 rounded-lg text-blue-100 text-sm whitespace-pre-line">
          <div className="font-semibold mb-1">📨 新着メール通知</div>
          {notification}
        </div>
      )}

      {/* Tool call cards */}
      {toolCalls.length > 0 && (
        <div className="mx-4 mt-3 space-y-1">
          {toolCalls.map((tc, idx) => (
            <ToolCallCard key={idx} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-16">
            <div className="text-4xl mb-4">🏗️</div>
            <p className="text-lg font-medium text-gray-400">Site Approval Bot</p>
            <p className="text-sm mt-2">
              「📧 許可メール到着」ボタンを押してデモを開始するか、
              <br />
              直接メッセージを入力してください。
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isThinking && (
          <div className="flex gap-2 items-center text-gray-400 text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>エージェントが処理中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力... (Enter で送信, Shift+Enter で改行)"
            rows={2}
            disabled={isThinking || !isConnected}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking || !isConnected}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div className="text-center text-red-400 text-sm py-1">{message.content}</div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-100"
        }`}
      >
        {!isUser && (
          <div className="text-xs text-gray-400 mb-1 font-medium">🤖 Agent</div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = toolCall.result !== undefined;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-750 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${hasResult ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
          <span className="text-gray-300 font-mono">
            🔧 {toolCall.tool_name}
          </span>
          {toolCall.arguments["query"] != null && (
            <span className="text-gray-500">
              — &quot;{String(toolCall.arguments["query"])}&quot;
            </span>
          )}
        </div>
        <span className="text-gray-500">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-700">
          <div className="mt-2">
            <div className="text-gray-400 mb-1">引数:</div>
            <pre className="bg-gray-900 rounded p-2 text-green-400 overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div className="mt-2">
              <div className="text-gray-400 mb-1">結果:</div>
              <pre className="bg-gray-900 rounded p-2 text-blue-300 overflow-x-auto max-h-40 overflow-y-auto">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
