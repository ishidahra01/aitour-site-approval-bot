"""
Site Approval Bot - Copilot SDK Agent Orchestrator

Handles agent lifecycle, tool registration, and streaming response generation.
"""

import asyncio
import json
import os
import re
import subprocess
from collections.abc import AsyncIterator
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from skills.site_approval import SITE_APPROVAL_SYSTEM_PROMPT
from tools.workiq_tool import search_work_items

# Timeout for waiting on agent session responses (seconds)
SESSION_TIMEOUT = 120

# Try to import Copilot SDK
try:
    from copilot import CopilotClient  # type: ignore
    from copilot.generated.session_events import SessionEventType  # type: ignore
    from copilot.types import Tool, ToolInvocation, ToolResult  # type: ignore

    COPILOT_SDK_AVAILABLE = True
except ImportError:
    COPILOT_SDK_AVAILABLE = False

# Try httpx for direct API calls
try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


# ---------------------------------------------------------------------------
# Tool definitions (OpenAI function-calling schema for direct API)
# ---------------------------------------------------------------------------

TOOLS_SCHEMA: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_work_items",
            "description": (
                "Work IQ MCP を使って Outlook・Teams・SharePoint から"
                "関連するメール・会議議事録・ドキュメントを検索します。"
                "Work IQ MCPが無効の場合はデモ用サンプルデータを返します。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "検索クエリ（例: 'A市 基地局', '高さ制限', 'small cell'）",
                    },
                    "top": {
                        "type": "integer",
                        "description": "最大取得件数（デフォルト: 5）",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    }
]


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------


async def execute_tool(name: str, arguments: dict[str, Any]) -> str:
    """Execute a tool call and return the result as a string."""
    if name == "search_work_items":
        query = arguments.get("query", "")
        top = arguments.get("top", 5)
        return await search_work_items(query, top)
    return json.dumps({"error": f"Unknown tool: {name}"})


# ---------------------------------------------------------------------------
# Agent - Copilot SDK path
# ---------------------------------------------------------------------------


async def _run_with_copilot_sdk(
    messages: list[dict[str, Any]],
) -> AsyncIterator[dict[str, Any]]:
    """Run agent using GitHub Copilot SDK (gh copilot CLI)."""

    async def _tool_handler(invocation: ToolInvocation) -> ToolResult:
        """Handle tool calls from the Copilot SDK."""
        try:
            args = invocation.arguments or {}
            if isinstance(args, str):
                args = json.loads(args)
            result_text = await execute_tool(invocation.tool_name, args)
            return ToolResult(text_result_for_llm=result_text)
        except Exception as e:
            return ToolResult(
                text_result_for_llm=json.dumps({"error": str(e)}),
                result_type="error",
                error=str(e),
            )

    sdk_tool = Tool(
        name="search_work_items",
        description=(
            "Work IQ MCP を使って Outlook・Teams・SharePoint から"
            "関連するメール・会議議事録・ドキュメントを検索します。"
            "Work IQ MCPが無効の場合はデモ用サンプルデータを返します。"
        ),
        handler=_tool_handler,
        parameters=TOOLS_SCHEMA[0]["function"]["parameters"],
    )

    # Queue to pass events from SDK callback to async generator
    event_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def run_session() -> None:
        try:
            async with CopilotClient() as client:
                session = await client.create_session(
                    {
                        "system_message": {
                            "mode": "replace",
                            "content": SITE_APPROVAL_SYSTEM_PROMPT,
                        },
                        "tools": [sdk_tool],
                    }
                )

                def on_event(event: Any) -> None:
                    etype = event.type
                    edata = getattr(event, "data", None)

                    if etype == SessionEventType.ASSISTANT_MESSAGE_DELTA:
                        delta = getattr(edata, "delta_content", None) or ""
                        if delta:
                            event_queue.put_nowait(
                                {"type": "text_delta", "content": delta}
                            )
                    elif etype == SessionEventType.EXTERNAL_TOOL_REQUESTED:
                        tool_name = getattr(edata, "tool_name", "")
                        args_raw = getattr(edata, "arguments", {}) or {}
                        if isinstance(args_raw, str):
                            try:
                                args_raw = json.loads(args_raw)
                            except json.JSONDecodeError:
                                args_raw = {}
                        event_queue.put_nowait(
                            {
                                "type": "tool_call",
                                "tool_name": tool_name,
                                "arguments": args_raw,
                            }
                        )
                    elif etype == SessionEventType.EXTERNAL_TOOL_COMPLETED:
                        tool_name = getattr(edata, "tool_name", "")
                        result = getattr(edata, "result", "")
                        event_queue.put_nowait(
                            {
                                "type": "tool_result",
                                "tool_name": tool_name,
                                "result": str(result),
                            }
                        )
                    elif etype == SessionEventType.SESSION_IDLE:
                        event_queue.put_nowait(None)  # Signal done
                    elif etype == SessionEventType.SESSION_ERROR:
                        msg = getattr(edata, "message", "Unknown session error")
                        event_queue.put_nowait({"type": "error", "content": msg})
                        event_queue.put_nowait(None)

                unsubscribe = session.on(on_event)

                # Build prompt from messages
                prompt = messages[-1]["content"] if messages else ""

                try:
                    await session.send({"prompt": prompt})
                    # Wait for SESSION_IDLE (signaled by None in queue)
                    while True:
                        item = await asyncio.wait_for(
                            event_queue.get(), timeout=SESSION_TIMEOUT
                        )
                        if item is None:
                            break
                        # item is already put in queue by on_event
                finally:
                    unsubscribe()
        except Exception as e:
            event_queue.put_nowait({"type": "error", "content": str(e)})
            event_queue.put_nowait(None)

    # Run session in background task
    task = asyncio.create_task(run_session())

    # Yield events from queue
    while True:
        item = await asyncio.wait_for(event_queue.get(), timeout=SESSION_TIMEOUT)
        if item is None:
            break
        yield item

    await task


# ---------------------------------------------------------------------------
# Agent - Direct OpenAI-compatible API path (fallback)
# ---------------------------------------------------------------------------


async def _run_with_direct_api(
    messages: list[dict[str, Any]],
) -> AsyncIterator[dict[str, Any]]:
    """
    Run agent using the GitHub Copilot API directly (OpenAI-compatible endpoint).
    Handles tool calls iteratively.
    """
    api_base = os.getenv("COPILOT_API_BASE", "https://api.githubcopilot.com")
    github_token = os.getenv("COPILOT_GITHUB_TOKEN")  # Only explicit Copilot token
    byok_provider = os.getenv("BYOK_PROVIDER", "").lower()
    byok_api_key = os.getenv("BYOK_API_KEY", "")
    byok_base_url = os.getenv("BYOK_BASE_URL", "")
    byok_model = os.getenv("BYOK_MODEL", "gpt-4o")
    byok_azure_api_version = os.getenv("BYOK_AZURE_API_VERSION", "2024-10-21")

    # Determine endpoint & headers
    if byok_provider == "azure" and byok_api_key and byok_base_url:
        endpoint = (
            f"{byok_base_url.rstrip('/')}/openai/deployments/{byok_model}"
            f"/chat/completions?api-version={byok_azure_api_version}"
        )
        headers = {
            "api-key": byok_api_key,
            "Content-Type": "application/json",
        }
        model = byok_model
    elif byok_provider == "openai" and byok_api_key:
        endpoint = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {byok_api_key}",
            "Content-Type": "application/json",
        }
        model = byok_model
    elif github_token:
        endpoint = f"{api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {github_token}",
            "Content-Type": "application/json",
            "Copilot-Integration-Id": "site-approval-bot",
            "Editor-Version": "site-approval-bot/1.0",
        }
        model = os.getenv("COPILOT_MODEL", "gpt-4o")
    else:
        # No credentials: use demo simulation
        async for event in _run_demo_simulation(messages):
            yield event
        return

    conversation: list[dict[str, Any]] = [
        {"role": "system", "content": SITE_APPROVAL_SYSTEM_PROMPT},
        *messages,
    ]

    async with httpx.AsyncClient(timeout=SESSION_TIMEOUT) as client:
        max_iterations = 10
        for _iteration in range(max_iterations):
            payload = {
                "model": model,
                "messages": conversation,
                "tools": TOOLS_SCHEMA,
                "stream": True,
                "temperature": 0.3,
            }

            # Collect the streamed response
            full_content = ""
            tool_calls_raw: dict[int, dict[str, Any]] = {}
            finish_reason = None

            async with client.stream(
                "POST",
                endpoint,
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield {
                        "type": "error",
                        "content": f"API error {response.status_code}: {error_text.decode()}",
                    }
                    return

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[len("data: "):]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = chunk.get("choices", [])
                    if not choices:
                        continue
                    choice = choices[0]
                    delta = choice.get("delta", {})
                    finish_reason = choice.get("finish_reason") or finish_reason

                    # Accumulate text content
                    content_delta = delta.get("content") or ""
                    if content_delta:
                        full_content += content_delta
                        yield {"type": "text_delta", "content": content_delta}

                    # Accumulate tool calls
                    for tc in delta.get("tool_calls", []):
                        idx = tc.get("index", 0)
                        if idx not in tool_calls_raw:
                            tool_calls_raw[idx] = {
                                "id": tc.get("id", ""),
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }
                        if tc.get("id"):
                            tool_calls_raw[idx]["id"] = tc["id"]
                        fn = tc.get("function", {})
                        if fn.get("name"):
                            tool_calls_raw[idx]["function"]["name"] += fn["name"]
                        if fn.get("arguments"):
                            tool_calls_raw[idx]["function"]["arguments"] += fn[
                                "arguments"
                            ]

            # Add assistant message to conversation
            assistant_msg: dict[str, Any] = {"role": "assistant"}
            if full_content:
                assistant_msg["content"] = full_content
            if tool_calls_raw:
                assistant_msg["tool_calls"] = list(tool_calls_raw.values())
            conversation.append(assistant_msg)

            # If no tool calls, we're done
            if not tool_calls_raw or finish_reason == "stop":
                break

            # Execute tool calls
            for idx in sorted(tool_calls_raw.keys()):
                tc = tool_calls_raw[idx]
                tool_name = tc["function"]["name"]
                try:
                    tool_args = json.loads(tc["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    tool_args = {}

                yield {
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "arguments": tool_args,
                }

                tool_result = await execute_tool(tool_name, tool_args)

                yield {
                    "type": "tool_result",
                    "tool_name": tool_name,
                    "result": tool_result,
                }

                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": tool_result,
                    }
                )


# ---------------------------------------------------------------------------
# Demo simulation (no API keys required)
# ---------------------------------------------------------------------------


async def _run_demo_simulation(
    messages: list[dict[str, Any]],
) -> AsyncIterator[dict[str, Any]]:
    """
    Simulate agent execution for demo purposes when no API credentials are available.
    Produces a realistic step-by-step flow with tool calls and a final report.
    """
    # Step 1: Announce search
    intro = "🔍 A市の設置許可関連情報を Work IQ MCP で検索しています...\n\n"
    for char in intro:
        yield {"type": "text_delta", "content": char}
        await asyncio.sleep(0.015)

    # Step 2: Simulate tool calls
    queries = ["A市 基地局", "アンテナ高さ カバレッジ", "small cell"]
    all_results: list[Any] = []

    for query in queries:
        yield {
            "type": "tool_call",
            "tool_name": "search_work_items",
            "arguments": {"query": query, "top": 5},
        }
        await asyncio.sleep(0.3)

        result = await search_work_items(query, 5)
        result_data = json.loads(result)
        all_results.extend(result_data.get("results", []))

        yield {
            "type": "tool_result",
            "tool_name": "search_work_items",
            "result": result,
        }
        await asyncio.sleep(0.2)

    # Step 3: Generate report
    found_msg = f"✅ {len(all_results)} 件の関連情報を収集しました。承認レポートを生成します...\n\n"
    for char in found_msg:
        yield {"type": "text_delta", "content": char}
        await asyncio.sleep(0.015)

    report = _generate_demo_report()

    # Stream the report character by character
    full_text = f"REPORT_START\n{report}\nREPORT_END"
    for char in full_text:
        yield {"type": "text_delta", "content": char}
        await asyncio.sleep(0.008)


def _generate_demo_report() -> str:
    return """Site Approval Report
====================

Site: A市 公園用地（サイトID: NTT-A001）
Generated: 自治体許可メール受信を契機に自動生成

Municipality Constraints（自治体条件）
--------------------------------------
✅ 高さ制限: 15m以下（A市都市計画課、2024年3月10日合意）
✅ 外観色指定: グレー系（RAL7035相当）
✅ 住民説明会: 2024年2月15日実施済み（参加者28名）
✅ 景観条例適合確認: 完了
✅ 自治体担当: 中村 太郎

RF Design Constraints（RF設計制約）
------------------------------------
⚠️ 必要アンテナ高さ: 20m（標準設計）
⚠️ 15m設置時カバレッジ: 85%（15%低下）
✅ 代替案: スモールセル×2基で同等カバレッジ達成可能
💴 スモールセル追加コスト: 約180万円
📅 ROI回収見込み: 2.3年
👤 RF設計担当: 鈴木 花子

Collected Information Sources（収集情報源）
-------------------------------------------
📧 中村さんメール「A市 5G基地局設置に関する自治体協議結果」(2024-03-10)
📧 鈴木さんメール「A市サイト RF設計検討結果」(2024-03-12)
💬 Teams「基地局設置プロジェクト > A市担当」中村さん投稿 (2024-03-08)
📋 会議議事録「A市基地局設置計画 技術検討会議」(2024-03-05)
📄 SharePoint「スモールセル設置基準ドキュメント v2.1」

Status（状況）
--------------
✅ Municipality requirements: 全条件クリア（高さ制限・色指定・住民説明）
⏳ RF design: スモールセル追加コスト承認待ち（担当部長へ申請中）
⏳ 最終許可書: 設置条件確認後に発行予定

Recommended Action（推奨アクション）
--------------------------------------
1. 🔺 【要対応】鈴木さんへスモールセル追加コスト（180万円）の部長承認状況確認
2. 📋 スモールセル設置基準に基づく事前届出をA市へ提出
3. ✅ 中村さんへ自治体条件充足の最終確認を依頼
4. 📅 設置工事スケジュール（目安: 1基あたり2週間）の確定

Summary（まとめ）
-----------------
自治体条件はすべて充足されています。
唯一の未解決事項は「スモールセル追加コスト承認」です。
鈴木さんへの承認確認が完了次第、設置工事に着手できます。"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _is_gh_authenticated() -> bool:
    """Check if the gh CLI is installed and authenticated."""
    try:
        result = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


async def run_agent(
    messages: list[dict[str, Any]],
    model: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """
    Run the Site Approval Bot agent with the given conversation messages.

    Tries the following backends in order:
    1. GitHub Copilot SDK (if gh CLI is installed and authenticated)
    2. Direct OpenAI-compatible API (if COPILOT_GITHUB_TOKEN or BYOK_* is set)
    3. Demo simulation (no credentials required)

    Yields events of the following types:
    - {"type": "text_delta", "content": str}  - streaming text
    - {"type": "tool_call", "tool_name": str, "arguments": dict}
    - {"type": "tool_result", "tool_name": str, "result": str}
    - {"type": "error", "content": str}
    - {"type": "done"}
    """
    if model:
        os.environ["COPILOT_MODEL"] = model

    if COPILOT_SDK_AVAILABLE and _is_gh_authenticated():
        try:
            async for event in _run_with_copilot_sdk(messages):
                yield event
        except Exception:
            # Copilot SDK failed — fall through to direct API or demo
            if HTTPX_AVAILABLE:
                async for event in _run_with_direct_api(messages):
                    yield event
            else:
                async for event in _run_demo_simulation(messages):
                    yield event
    elif HTTPX_AVAILABLE:
        async for event in _run_with_direct_api(messages):
            yield event
    else:
        async for event in _run_demo_simulation(messages):
            yield event

    yield {"type": "done"}


def extract_report(full_text: str) -> str | None:
    """Extract the report content from agent output text."""
    match = re.search(r"REPORT_START\n(.*?)\nREPORT_END", full_text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None
