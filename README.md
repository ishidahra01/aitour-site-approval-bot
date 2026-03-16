# 🤖 Site Approval Bot

> AI agent for automating municipality site approval workflows, built with **GitHub Copilot SDK**, **Azure AI Foundry**, **Foundry IQ**, **Work IQ**, and a **Next.js Chat UI**.

[📐 Architecture Details](docs/architecture.md)

---

## 🎯 Overview

This project demonstrates a complete **Site Approval Bot** — an AI agent that automates the approval workflow for mobile base station (基地局) site installation requests.

When a municipality permission email arrives, the agent automatically:

1. Collects all relevant past discussion context via **Work IQ** (Outlook emails, Teams conversations, meeting minutes, SharePoint documents)
2. Searches **enterprise knowledge** (internal runbooks, architecture docs, SOPs) via **Foundry IQ** (Azure AI Search MCP)
3. Performs deep research via **Azure AI Foundry** (web search-grounded multi-step research) when needed
4. Searches **Microsoft Docs** for official product guidance
5. Generates a structured **Site Approval Report** identifying municipality conditions, RF design constraints, outstanding decisions, and required approvers
6. Generates **PowerPoint reports** summarizing findings on request
7. Uses **GitHub Copilot SDK** as the primary agent orchestrator

---

## 🏗️ Architecture

```
User (municipality email or chat)
 ↓
Next.js Chat UI (port 3000)
 ↓ WebSocket
FastAPI Backend (port 8000)
 ↓
Site Approval Bot Agent (GitHub Copilot SDK)
 ├─ Tool: work_iq_tool                → Work IQ MCP Server (npx @microsoft/workiq mcp)
 ├─ Tool: foundry_knowledge_tool      → Azure AI Search MCP (@azure/mcp, azureaisearch namespace)
 ├─ Tool: foundry_deep_research_tool  → Azure AI Foundry Agent (WebSearchTool)
 ├─ Tool: query_ms_docs_tool          → MS Docs MCP Server (npx @microsoft/learn-docs-mcp)
 └─ Tool: generate_powerpoint_tool    → python-pptx (local .pptx generation)
```

### Knowledge Layers

The agent combines four knowledge layers for comprehensive site approval investigations:

| Layer | Source | Tool | Purpose |
|-------|--------|------|---------|
| Org Context | Work IQ (Microsoft Graph) | `work_iq_tool` | Emails, Teams, meeting minutes, SharePoint |
| Enterprise Knowledge | Foundry IQ (Azure AI Search) | `foundry_knowledge_tool` | Internal runbooks, architecture docs, SOPs |
| Official Docs | Microsoft Learn / MS Docs MCP | `query_ms_docs_tool` | Official product guidance |
| Web Research | Azure AI Foundry (web search) | `foundry_deep_research_tool` | Latest public information |

### Component Details

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Chat UI | Next.js + React + Tailwind CSS | Streaming chat with approval report panel and tool execution visibility |
| Backend API | FastAPI + WebSocket | Bridges UI and Copilot SDK; serves report downloads |
| Agent Runtime | GitHub Copilot SDK (Python) | Orchestrates tools, maintains conversation context |
| Work IQ | `@microsoft/workiq` MCP | Retrieves emails, Teams messages, meeting minutes, SharePoint documents |
| Foundry IQ | `@azure/mcp` (azureaisearch) | Queries enterprise knowledge bases |
| Deep Research | Azure AI Foundry (`azure-ai-projects`) | Multi-step web research with WebSearch grounding |
| MS Docs MCP | `@microsoft/learn-docs-mcp` | Queries official Microsoft documentation |
| PowerPoint | `python-pptx` | Generates structured .pptx reports |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Details |
|-------------|---------|
| GitHub Copilot subscription | [Pricing](https://github.com/features/copilot#pricing) · free tier available |
| Copilot CLI | `gh extension install github/gh-copilot` |
| Node.js 18+ | For frontend and MCP servers |
| Python 3.11+ | For backend |
| Azure subscription (optional) | For Foundry Deep Research and Foundry IQ |
| M365 Copilot license (optional) | For live Work IQ MCP |

### 1. Clone & Configure

```bash
git clone https://github.com/ishidahra01/aitour-site-approval-bot.git
cd aitour-site-approval-bot

# Copy environment template
cp .env.example .env
# Edit .env with your credentials (see Required Credentials below)
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend
python main.py
# Or with uvicorn directly:
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be available at `http://localhost:8000`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The chat UI will be available at `http://localhost:3000`.

### 4. Authenticate GitHub Copilot CLI

```bash
# Install and authenticate the Copilot CLI
gh extension install github/gh-copilot
gh auth login
gh copilot --version   # verify it works
```

---

## 🔐 Required Credentials

### Minimum (GitHub Copilot only)

```env
# .env
COPILOT_GITHUB_TOKEN=ghp_your_github_token
```

Or simply ensure you are logged in via `gh auth login` — the SDK picks up your credentials automatically.

### Optional: BYOK (Bring Your Own Key)

If you don't have a GitHub Copilot subscription, you can use your own Azure OpenAI or OpenAI API key:

```env
BYOK_PROVIDER=azure          # openai | azure | anthropic
BYOK_API_KEY=your_key
BYOK_BASE_URL=https://your-resource.openai.azure.com
BYOK_MODEL=gpt-4o
BYOK_AZURE_API_VERSION=2024-10-21
```

### Optional: Work IQ (M365 Organizational Context)

```env
WORKIQ_ENABLED=true
# Set WORKIQ_SAMPLE_MODE=true to use local sample data for demos/testing (default: false)
WORKIQ_SAMPLE_MODE=false
```

For live Work IQ access:
```bash
npm install -g @microsoft/workiq
workiq login    # authenticate with your Microsoft 365 account
```

Your **M365 tenant admin** must also grant consent at:
`https://login.microsoftonline.com/common/adminconsent?client_id=<workiq-app-id>`

See [Work IQ Admin Instructions](https://github.com/microsoft/work-iq-mcp/blob/main/ADMIN-INSTRUCTIONS.md) for details.

> For local development / demo without an M365 subscription, set `WORKIQ_SAMPLE_MODE=true`.
> Sample data files are in `backend/sample_data/work_iq/`.

### Optional: Azure AI Foundry (Deep Research)

```env
AZURE_FOUNDRY_PROJECT_ENDPOINT=https://your-project.api.azureml.ms
FOUNDRY_MODEL_DEPLOYMENT_NAME=your-deployment-name
```

Set up in [Azure AI Foundry](https://ai.azure.com):
1. Create an Azure AI Foundry project
2. Deploy a model with **Web Search** enabled

### Optional: Foundry IQ (Enterprise Knowledge Retrieval)

```env
AZURE_FOUNDRY_PROJECT_ENDPOINT=https://your-search-resource.search.windows.net
AZURE_SEARCH_INDEX_NAME=foundry-iq
FOUNDRY_IQ_SAMPLE_MODE=false
```

> **Note:** `AZURE_FOUNDRY_PROJECT_ENDPOINT` is reused for Foundry IQ but should point to your **Azure AI Search** endpoint (e.g. `https://your-search-resource.search.windows.net`), not an Azure AI Foundry project endpoint.

Foundry IQ uses **Azure AI Search MCP** (`@azure/mcp`) to query enterprise knowledge bases (internal runbooks, architecture docs, SOPs).

- Reference: [Azure AI Search MCP docs](https://learn.microsoft.com/en-us/azure/search/search-get-started-mcp)
- Set `FOUNDRY_IQ_SAMPLE_MODE=true` to use local sample data (no Azure subscription required)

For local development / demo, use the built-in sample data:
```env
FOUNDRY_IQ_SAMPLE_MODE=true
```

### Optional: MS Docs MCP

```bash
npm install -g @microsoft/learn-docs-mcp
```

If not installed, the agent falls back to providing a direct search URL.

---

## 💬 Demo Walkthrough

### Sample Scenario

> **User:** "新しい許可書メールが届きました。中村市と鈴木設計の担当者から必要な承認を集めてください。"
> *(New permission emails have arrived. Please collect the required approvals from Nakamura City and Suzuki Design contacts.)*

**Agent flow:**

1. 📧 **Work IQ search** — retrieves municipality coordination emails, Teams conversation history, and meeting minutes
2. 🏢 **Foundry IQ** — checks internal runbooks and architecture documentation for known constraints
3. 🔬 **Foundry Deep Research** — performs additional web research if needed
4. 📋 **Approval Report** — generates a structured `site-approval-report` rendered in the right panel
5. 📊 **PowerPoint** — generates a downloadable .pptx report on request

### Site Approval Report Format

The agent produces a structured report in a dedicated right-hand panel:

```
Site Approval Report
====================

Site: [Site name / location]
Triggered by: [Trigger event]
Date: [Date]

Municipality Conditions
-----------------------
- [Condition 1]: satisfied / pending / unknown
- [Condition 2]: ...

RF Design Conditions
--------------------
- [Condition 1]: satisfied / pending cost approval

Status Summary
--------------
- Municipality requirements: satisfied / partially satisfied / pending
- RF design: satisfied / pending cost approval / requires action
- Outstanding issues: ...

Recommended Actions
-------------------
1. [Action item] — Responsible: [Person/team]

Approval Required From
----------------------
- [Person 1] ([Role/reason])
```

### Demo Sample Data

Sample data is provided for local demos without live M365 or Azure subscriptions:

| File | Content |
|------|---------|
| `nakamura_municipality_email.md` | Municipality permission email from Nakamura City |
| `suzuki_design_constraints.md` | RF design constraints from Suzuki Design team |
| `teams_meeting_minutes.md` | Internal coordination meeting minutes |
| `cost_approval_discussion.md` | Cost approval discussion thread |

Enable sample mode:
```env
WORKIQ_SAMPLE_MODE=true
FOUNDRY_IQ_SAMPLE_MODE=true
```

### UI Features

| Feature | Description |
|---------|-------------|
| 💬 Streaming responses | Messages appear character-by-character as the model generates them |
| 📋 Approval Report Panel | Right-hand panel renders the structured site approval report |
| 🔧 Tool execution cards | Expandable cards show what tools ran, with arguments and results |
| 📥 Download button | Appears automatically when a PowerPoint is generated |
| 🤖 Model selector | Switch between GPT-4o, GPT-4.1, Claude Sonnet, o4-mini |
| ➕ New chat | Start a fresh conversation |

---

## 📁 Project Structure

```
.
├── backend/
│   ├── main.py                          # FastAPI app with WebSocket + REST endpoints
│   ├── agent.py                         # Copilot SDK agent orchestrator
│   ├── requirements.txt
│   ├── tools/
│   │   ├── work_iq_tool.py              # Work IQ organizational context retrieval
│   │   ├── foundry_iq_tool.py           # Foundry IQ enterprise knowledge retrieval (Azure AI Search MCP)
│   │   ├── foundry_tool.py              # Azure AI Foundry deep research (WebSearch)
│   │   ├── pptx_tool.py                 # PowerPoint generator (python-pptx)
│   │   ├── msdocs_tool.py               # MS Docs MCP wrapper
│   │   └── __init__.py
│   ├── skills/
│   │   ├── site_approval.py             # Site Approval Bot system prompt / workflow
│   │   └── support_investigation.py    # Generic support investigation skill
│   ├── sample_data/
│   │   ├── work_iq/                     # Sample organizational context (for local demo)
│   │   │   ├── nakamura_municipality_email.md
│   │   │   ├── suzuki_design_constraints.md
│   │   │   ├── teams_meeting_minutes.md
│   │   │   └── cost_approval_discussion.md
│   │   └── foundry_iq/                  # Sample enterprise knowledge files (for local demo)
│   │       ├── microsoft-foundry-architecture.md
│   │       ├── microsoft-foundry-rollout-checklist.md
│   │       ├── microsoft-foundry-incident-runbook.md
│   │       ├── microsoft-foundry-known-issues.md
│   │       └── microsoft-foundry-postmortem.md
│   └── generated_reports/               # Generated .pptx files (git-ignored)
├── frontend/
│   ├── app/
│   │   ├── page.tsx                     # Main page
│   │   ├── layout.tsx                   # App layout
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx        # Main chat component (WebSocket, state)
│   │   │   ├── MessageList.tsx          # Message list + typing indicator
│   │   │   ├── ApprovalReportPanel.tsx  # Right-panel site approval report renderer
│   │   │   ├── ToolExecutionCard.tsx    # Collapsible tool execution display
│   │   │   ├── AgentEventCard.tsx       # Collapsible agent event display
│   │   │   └── ModelSelector.tsx        # Model dropdown
│   │   └── lib/
│   │       ├── api.ts                   # API/WebSocket client
│   │       └── types.ts                 # TypeScript types
│   └── package.json
├── docs/
│   └── architecture.md                  # Detailed architecture documentation
├── .env.example                         # Environment variable template
└── README.md
```

---

## 🔌 API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/models` | List available Copilot models |
| `POST` | `/sessions` | Create a new chat session |
| `DELETE` | `/sessions/{id}` | Delete a session |
| `GET` | `/reports/{filename}` | Download a generated PowerPoint |

### WebSocket: `ws://localhost:8000/ws/chat/{session_id}`

**Client → Server:**
```json
{ "prompt": "Your question here", "model": "gpt-4o" }
```

**Server → Client (streaming events):**
```json
{ "type": "assistant.message_delta", "content": "..." }
{ "type": "tool.execution_start", "tool_name": "work_iq_tool", "args": {...} }
{ "type": "tool.execution_complete", "tool_name": "work_iq_tool", "result": "..." }
{ "type": "assistant.message", "content": "..." }
{ "type": "session.idle" }
{ "type": "error", "message": "..." }
```

---

## 🧩 Extending the Agent

### Adding a New Tool

1. Create a new file in `backend/tools/`:

```python
from pydantic import BaseModel, Field
from copilot import define_tool

class MyToolParams(BaseModel):
    query: str = Field(description="The input to my tool")

@define_tool(description="Description of what this tool does")
async def my_custom_tool(params: MyToolParams) -> str:
    # Your implementation here
    return "Tool result"
```

2. Import and add it to `tools/__init__.py`
3. Add it to the `tools` list in `agent.py`

### Modifying the Agent Workflow

Edit `backend/skills/site_approval.py` to change:
- The agent's role and expertise
- The investigation workflow steps
- The site approval report format
- Tool usage guidelines

---

## 💡 Stretch Goals

- [ ] Token usage / cost tracking dashboard
- [ ] Multi-model comparison mode (run the same query on multiple models)
- [ ] Safety guardrails and content filtering
- [ ] Observability dashboard (traces, latency, tool usage stats)
- [ ] Conversation export (PDF, Markdown)
- [ ] Session persistence across page reloads
- [ ] Email trigger integration (auto-invoke agent on new municipality emails)

---

## 📖 References

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [GitHub Copilot SDK Cookbook](https://github.com/github/awesome-copilot/tree/main/cookbook/copilot-sdk)
- [Azure AI Foundry Deep Research](https://azure.microsoft.com/en-us/blog/introducing-deep-research-in-azure-ai-foundry-agent-service/)
- [Azure AI Search MCP (Foundry IQ)](https://learn.microsoft.com/en-us/azure/search/search-get-started-mcp)
- [Work IQ MCP](https://github.com/microsoft/work-iq-mcp)
- [Microsoft Learn Docs MCP](https://github.com/MicrosoftDocs/mcp)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)

---

## 📄 License

MIT — see [LICENSE](LICENSE)
