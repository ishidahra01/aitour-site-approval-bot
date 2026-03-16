"""
Site Approval Bot - FastAPI Backend

Provides:
  - WebSocket /ws/chat  → streaming agent responses
  - POST /api/trigger   → simulate municipality approval email trigger
  - GET  /api/health    → health check
"""

import json
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from agent import extract_report, run_agent

app = FastAPI(
    title="Site Approval Bot",
    description="NTTグループ 5G基地局設置計画 Site Approval Bot API",
    version="1.0.0",
)

# Allow the Next.js frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "app": "site-approval-bot"}


# ---------------------------------------------------------------------------
# Trigger endpoint – simulates a municipality approval email arriving
# ---------------------------------------------------------------------------


@app.post("/api/trigger")
async def trigger_municipality_email() -> dict[str, Any]:
    """
    Simulate receiving a municipality approval email for site A.
    The frontend can call this to trigger the demo flow.
    """
    return {
        "event": "municipality_email_received",
        "site": "A市 公園用地",
        "site_id": "NTT-A001",
        "message": (
            "【A市から設置許可メールが到着しました】\n\n"
            "件名: 5G基地局設置申請 許可通知（サイトID: NTT-A001）\n"
            "差出人: A市 都市計画課 <info@a-city.example.jp>\n\n"
            "貴社から申請のありました公園用地への5G基地局設置につきまして、"
            "以下の条件を遵守することを前提に設置を許可します。\n\n"
            "・アンテナ高さ: 15m以下\n"
            "・外観色: グレー系（景観条例準拠）\n"
            "・工事期間: 許可書発行から6ヶ月以内\n\n"
            "詳細は添付の許可書をご確認ください。"
        ),
        "suggested_prompt": (
            "A市から設置許可メールが到着しました（サイトID: NTT-A001）。"
            "Work IQで過去の議論を収集し、承認レポートを生成してください。"
        ),
    }


# ---------------------------------------------------------------------------
# WebSocket chat endpoint
# ---------------------------------------------------------------------------


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for streaming agent chat.

    Client sends JSON:
      {"type": "message", "content": str, "model": str | null, "history": [...]}

    Server streams JSON events:
      {"type": "text_delta", "content": str}
      {"type": "tool_call", "tool_name": str, "arguments": {...}}
      {"type": "tool_result", "tool_name": str, "result": str}
      {"type": "report_update", "content": str}
      {"type": "done"}
      {"type": "error", "content": str}
    """
    await websocket.accept()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"type": "error", "content": "Invalid JSON"})
                )
                continue

            if data.get("type") != "message":
                continue

            user_content: str = data.get("content", "").strip()
            if not user_content:
                continue

            model: str | None = data.get("model")
            history: list[dict[str, Any]] = data.get("history", [])

            # Build messages list
            messages = [*history, {"role": "user", "content": user_content}]

            # Stream agent responses
            accumulated_text = ""
            report_sent = False

            async for event in run_agent(messages, model=model):
                await websocket.send_text(json.dumps(event, ensure_ascii=False))

                # Accumulate text to extract report
                if event.get("type") == "text_delta":
                    accumulated_text += event.get("content", "")

                    # Check for report content
                    if not report_sent:
                        report = extract_report(accumulated_text)
                        if report:
                            report_sent = True
                            await websocket.send_text(
                                json.dumps(
                                    {"type": "report_update", "content": report},
                                    ensure_ascii=False,
                                )
                            )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False)
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
