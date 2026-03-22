"use client";

import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useId } from "react";
import { ChatMessage } from "@/app/lib/types";
import { extractUrls } from "@/app/lib/utils";
import AgentLogPanel from "./AgentLogPanel";
import ToolExecutionCard from "./ToolExecutionCard";

interface Props {
  messages: ChatMessage[];
}

/** Work IQ gradient icon (small, for inline use). */
function WorkIQIconSmall({ className = "w-3.5 h-3.5" }: { className?: string }) {
  const uid = useId();
  const g1 = `msg-wiq-a-${uid}`;
  const g2 = `msg-wiq-b-${uid}`;
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

/**
 * Work IQ Sources bar shown below AI messages when Work IQ tool results
 * contain source URLs.
 */
function WorkIQSourcesBar({ message }: { message: ChatMessage }) {
  const workiqTools = (message.toolExecutions ?? []).filter(
    (te) =>
      te.toolName.toLowerCase().includes("workiq") &&
      te.status === "complete" &&
      !!te.result
  );

  const allUrls = workiqTools.flatMap((te) => extractUrls(te.result ?? ""));
  const uniqueUrls = [...new Set(allUrls)];

  if (uniqueUrls.length === 0) return null;

  return (
    <div
      className="mt-1 px-3 py-2 rounded-xl
        bg-gradient-to-r from-cyan-50/80 to-purple-50/80
        dark:from-cyan-900/10 dark:to-purple-900/10
        border border-purple-200 dark:border-purple-800/50
        text-xs w-full"
    >
      <p className="flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 mb-1.5">
        <WorkIQIconSmall />
        Work IQ Sources
      </p>
      <ul className="space-y-0.5">
        {uniqueUrls.map((url, i) => (
          <li key={i} className="flex items-start gap-1">
            <span className="text-purple-400 dark:text-purple-600 shrink-0 mt-px">
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
          text-white text-sm font-bold mr-2 mt-1 shrink-0">
          AI
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Agent execution logs – GitHub Copilot Activity Log style */}
        {!isUser && message.agentEvents && message.agentEvents.length > 0 && (
          <div className="w-full mb-2">
            <AgentLogPanel events={message.agentEvents} />
          </div>
        )}

        {/* Tool executions (shown before the message for assistant) */}
        {!isUser && message.toolExecutions && message.toolExecutions.length > 0 && (
          <div className="w-full mb-2">
            {message.toolExecutions.map((te) => (
              <ToolExecutionCard key={te.id} execution={te} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        {message.content && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? "bg-blue-600 text-white rounded-tr-sm"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm shadow-sm"
            } ${message.isStreaming ? "animate-pulse" : ""}`}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap">{message.content}</span>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ node, className, children, ...props }: any) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-auto mt-2 mb-2">
                        <code className="text-xs" {...props}>{children}</code>
                      </pre>
                    );
                  },
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 underline">
                      {children}
                    </a>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>
                  ),
                  hr: () => <hr className="border-gray-200 dark:border-gray-600 my-3" />,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-400 pl-3 italic text-gray-600 dark:text-gray-400 my-2">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Work IQ source links (below AI message bubble) */}
        {!isUser && <WorkIQSourcesBar message={message} />}

        {/* Timestamp */}
        <span className="text-xs text-gray-400 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center
          text-gray-700 dark:text-gray-200 text-sm font-bold ml-2 mt-1 shrink-0">
          👤
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
        text-white text-sm font-bold mr-2 shrink-0">
        AI
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = messages.some((m) => m.isStreaming);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="text-5xl mb-4">🗼</div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Site Project Copilot
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md text-sm leading-relaxed">
          基地局設置PJに関する情報収集、状況整理、比較分析、提案資料作成、
          PJ支援コンテンツの生成をまとめて支援します。
        </p>
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {[
            "A市案件の未解決事項を整理して",
            "社内基準と顧客要求の差分を比較して",
            "PJ進捗を見える化するツール案を作って",
          ].map((hint) => (
            <span
              key={hint}
              className="px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300
                rounded-full text-xs border border-green-200 dark:border-green-700"
            >
              {hint}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

