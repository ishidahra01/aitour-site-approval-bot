"""
Site Approval Bot - Work IQ MCP Tool
Provides Work IQ MCP integration with demo/sample mode fallback.
"""

import json
import os
import asyncio
from typing import Any

# Demo sample data representing the NTT 5G base station site approval scenario
DEMO_WORKIQ_DATA = {
    "A市 基地局": [
        {
            "type": "email",
            "subject": "【A市】5G基地局設置に関する自治体協議結果",
            "from": "中村 太郎 <nakamura@company.example>",
            "date": "2024-03-10",
            "body": (
                "A市都市計画課との協議が完了しました。\n\n"
                "【合意事項】\n"
                "・アンテナ高さ制限: 15m以下\n"
                "・外観色指定: グレー系（RAL7035相当）\n"
                "・住民説明会: 2024年2月15日実施済み（参加者28名）\n"
                "・景観条例適合確認: 完了\n\n"
                "住民からの反対意見はなく、設置条件を満たせば許可が下りる見込みです。"
            ),
        },
        {
            "type": "teams_message",
            "channel": "基地局設置プロジェクト > A市担当",
            "from": "中村 太郎",
            "date": "2024-03-08",
            "body": (
                "A市の許可条件まとめ:\n"
                "✅ 高さ15m以下\n"
                "✅ グレー系カラー\n"
                "✅ 住民説明会済み\n"
                "⚠️ 最終許可書の発行は設置条件確認後"
            ),
        },
    ],
    "アンテナ高さ カバレッジ": [
        {
            "type": "email",
            "subject": "A市サイト RF設計検討結果",
            "from": "鈴木 花子 <suzuki@company.example>",
            "date": "2024-03-12",
            "body": (
                "A市サイトのRF設計シミュレーション結果をご報告します。\n\n"
                "【設計制約】\n"
                "・必要アンテナ高さ: 20m（標準設計）\n"
                "・15mの場合: カバレッジ85%（15%低下）\n"
                "・代替案: スモールセル2基設置で同等カバレッジ達成可能\n\n"
                "【コスト試算】\n"
                "・スモールセル2基: 約180万円追加\n"
                "・承認待ち: 鈴木が担当部長へ申請中\n\n"
                "高さ制限を遵守しながらカバレッジを確保するには、"
                "スモールセル追加が現実的な解決策です。"
            ),
        },
        {
            "type": "meeting_minutes",
            "title": "A市基地局設置計画 技術検討会議",
            "date": "2024-03-05",
            "attendees": ["鈴木 花子", "中村 太郎", "田中 部長"],
            "body": (
                "【議題】A市基地局の高さ制限対応\n\n"
                "鈴木氏より:\n"
                "- 20mが技術的最適だが、15m制限の場合85%カバレッジ\n"
                "- スモールセル×2で100%近いカバレッジ達成可能\n"
                "- 追加コスト180万円、ROI試算では2.3年で回収見込み\n\n"
                "田中部長より:\n"
                "- スモールセル案を採用する方向で検討\n"
                "- 最終承認は許可書受領後"
            ),
        },
    ],
    "small cell": [
        {
            "type": "sharepoint_doc",
            "title": "スモールセル設置基準ドキュメント v2.1",
            "url": "https://sharepoint.example/sites/network/SmallCellGuide",
            "date": "2024-01-15",
            "body": (
                "スモールセル設置基準\n\n"
                "1. 設置条件: 既存インフラ（電柱等）への取り付け可\n"
                "2. 最大出力: 2W（屋外型）\n"
                "3. 設置間隔: 200-300m推奨\n"
                "4. 許認可: 市区町村への事前届出が必要\n"
                "5. 工期目安: 1基あたり2週間"
            ),
        }
    ],
}


def _demo_search(query: str) -> list[dict[str, Any]]:
    """Search demo data by query keywords."""
    results = []
    query_lower = query.lower()
    for key, items in DEMO_WORKIQ_DATA.items():
        key_words = key.split()
        if any(word in query_lower for word in key_words) or any(
            word.lower() in query_lower for word in key_words
        ):
            results.extend(items)
    if not results:
        for items in DEMO_WORKIQ_DATA.values():
            results.extend(items)
    return results[:5]


async def search_work_items(query: str, top: int = 5) -> str:
    """
    Search Work IQ (M365 data: Outlook, Teams, SharePoint) for relevant items.
    Falls back to demo data when WORKIQ_ENABLED is not set.

    Args:
        query: Search query string (e.g. "A市 基地局", "高さ制限")
        top: Maximum number of results to return

    Returns:
        JSON string with search results
    """
    workiq_enabled = os.getenv("WORKIQ_ENABLED", "false").lower() == "true"

    if workiq_enabled:
        try:
            return await _real_workiq_search(query, top)
        except Exception as e:
            return json.dumps(
                {"error": f"Work IQ search failed: {e}", "results": []},
                ensure_ascii=False,
            )
    else:
        # Demo mode: return sample data
        results = _demo_search(query)
        return json.dumps(
            {
                "mode": "demo",
                "query": query,
                "results": results[:top],
                "total": len(results),
            },
            ensure_ascii=False,
            indent=2,
        )


async def _real_workiq_search(query: str, top: int) -> str:
    """Call the actual Work IQ MCP server."""
    import subprocess
    import sys

    # Build MCP call to Work IQ server
    mcp_input = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "search",
                "arguments": {"query": query, "top": top},
            },
        }
    )

    proc = await asyncio.create_subprocess_exec(
        "npx",
        "@microsoft/workiq",
        "mcp",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(
        proc.communicate(mcp_input.encode()), timeout=30
    )

    if proc.returncode != 0:
        raise RuntimeError(stderr.decode())

    response = json.loads(stdout.decode())
    result_content = response.get("result", {}).get("content", [])
    text_parts = [
        item.get("text", "") for item in result_content if item.get("type") == "text"
    ]
    return "\n".join(text_parts) or json.dumps({"results": []})
