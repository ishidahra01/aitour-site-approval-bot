"""
Work IQ Tool — Organizational Context Retrieval.

Queries recent collaboration context (emails, Teams conversations, meeting
minutes, SharePoint documents) via Work IQ MCP.

Supports two modes:
  - Sample data mode (WORKIQ_SAMPLE_MODE=true):
      Returns results from local demo markdown files under
      backend/sample_data/work_iq/.  Useful for local development
      and demos without a live Work IQ subscription.
  - Real mode (default):
      Delegates to the Work IQ MCP server that was attached to the Copilot
      session at startup (via _build_mcp_servers in agent.py).
      Requires WORKIQ_ENABLED=true.
"""
from __future__ import annotations

import logging
import os
import pathlib

from pydantic import BaseModel, Field
from copilot import define_tool

logger = logging.getLogger(__name__)

_SAMPLE_DATA_DIR = (
    pathlib.Path(__file__).parent.parent / "sample_data" / "work_iq"
)

# Maximum number of top documents to include in a response.
_TOP_K = 4


class WorkIQParams(BaseModel):
    query: str = Field(
        description=(
            "Search query for organizational context — emails, Teams messages, "
            "meeting minutes, SharePoint documents, or calendar events relevant "
            "to the current task."
        )
    )


@define_tool(
    description=(
        "Search recent organizational context using Work IQ. "
        "Retrieves relevant emails (Outlook), Teams conversation messages, "
        "meeting minutes, SharePoint documents, and calendar events. "
        "Use this tool to find past discussions, decisions, constraints, "
        "and action items related to a site or project."
    )
)
async def work_iq_tool(params: WorkIQParams) -> str:
    """Search Work IQ for organizational collaboration context."""
    sample_mode = (
        os.environ.get("WORKIQ_SAMPLE_MODE", "false").lower() == "true"
    )

    if sample_mode:
        return await _search_sample_data(params.query)

    return _not_configured_message(params.query)


# ---------------------------------------------------------------------------
# Sample data mode
# ---------------------------------------------------------------------------

async def _search_sample_data(query: str) -> str:
    """Search through sample markdown files for relevant content."""
    if not _SAMPLE_DATA_DIR.exists():
        return (
            f"[Work IQ - Sample Mode] Sample data directory not found: "
            f"{_SAMPLE_DATA_DIR}"
        )

    query_lower = query.lower()
    query_terms = [t for t in query_lower.split() if len(t) > 2]

    matches: list[tuple[int, str, str]] = []
    for md_file in sorted(_SAMPLE_DATA_DIR.glob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        content_lower = content.lower()
        score = sum(1 for term in query_terms if term in content_lower)
        if score > 0:
            matches.append((score, md_file.name, content))

    if not matches:
        # Return all files when no specific match — useful for broad queries
        all_files = sorted(_SAMPLE_DATA_DIR.glob("*.md"))
        if all_files:
            matches = [
                (1, f.name, f.read_text(encoding="utf-8")) for f in all_files
            ]
        else:
            return (
                f"[Work IQ - Sample Mode] No organizational context found "
                f"for: '{query}'"
            )

    matches.sort(key=lambda x: -x[0])

    results: list[str] = []
    for _score, filename, content in matches[:_TOP_K]:
        lines = content.splitlines()
        snippet = "\n".join(lines[:80])
        if len(lines) > 80:
            snippet += f"\n\n[...content truncated. Source: {filename}]"
        results.append(f"### 📧 {filename}\n\n{snippet}")

    header = (
        f"[Work IQ - Sample Mode] Found {len(matches)} relevant "
        f"document(s) for: '{query}'\n\n"
    )
    return header + "\n\n---\n\n".join(results)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _not_configured_message(query: str) -> str:
    return (
        "[Work IQ] Work IQ MCP is not configured in sample mode. "
        "Set WORKIQ_SAMPLE_MODE=true to use sample data for local testing, "
        "or set WORKIQ_ENABLED=true to attach the live Work IQ MCP server.\n"
        f"Query: {query}"
    )
