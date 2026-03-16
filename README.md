# Site Approval Bot

**Work IQ × GitHub Copilot SDK** を活用した自動承認レポート生成エージェントアプリ

NTTグループ向けデモシナリオ「5Gエリア拡大の基地局設置計画」における
GitHub Copilot SDK デモを実装したものです。

---

## 概要

> 「自治体からメールが来ただけで、過去の全議論が自動で集まり承認レポートが生成される」

### デモフロー

1. **「📧 許可メール到着」** ボタンを押すと、A市からの設置許可メール到着をシミュレート
2. **Copilot SDK Agent** が自動起動
3. **Work IQ MCP** を呼び出して過去の議論・メール・会議議事録を収集
4. **承認レポート**を自動生成
5. 左パネルに会話、右パネルにレポートをリアルタイム表示

---

## アーキテクチャ

```
┌──────────────────────┬───────────────────────┐
│ Chat UI              │ Generated Output      │
│                      │                       │
│ User / Agent Chat    │ 承認レポート          │
│                      │                       │
│                      │ エージェント生成内容  │
└──────────────────────┴───────────────────────┘
         ↓ WebSocket
FastAPI Backend (port 8000)
         ↓
Copilot SDK Agent
         └── Work IQ MCP (Outlook / Teams / SharePoint)
```

---

## セットアップ

### 前提条件

| 要件 | 詳細 |
|------|------|
| Node.js 18+ | フロントエンド |
| Python 3.11+ | バックエンド |
| GitHub Copilot (任意) | エージェント実行 |
| M365 Copilot ライセンス (任意) | Work IQ MCP |

### 1. 環境変数設定

```bash
cp .env.example .env
# .env を編集して認証情報を設定
```

### 2. バックエンド起動

```bash
cd backend

# 仮想環境作成
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 依存関係インストール
pip install -r requirements.txt

# 起動
python main.py
```

バックエンドは `http://localhost:8000` で起動します。

### 3. フロントエンド起動

```bash
cd frontend

cp .env.local.example .env.local

npm install
npm run dev
```

フロントエンドは `http://localhost:3000` で起動します。

---

## 認証情報

### GitHub Copilot（最小構成）

```env
COPILOT_GITHUB_TOKEN=ghp_your_github_token
```

`gh auth login` で認証後、`gh auth token` でトークン取得。

### BYOK（独自APIキー使用）

GitHub Copilot サブスクリプションがない場合:

```env
BYOK_PROVIDER=azure          # openai | azure
BYOK_API_KEY=your_key
BYOK_BASE_URL=https://your-resource.openai.azure.com
BYOK_MODEL=gpt-4o
BYOK_AZURE_API_VERSION=2024-10-21
```

### Work IQ MCP（M365アクセス）

```env
WORKIQ_ENABLED=true
```

```bash
npm install -g @microsoft/workiq
workiq login
```

> **Note:** `WORKIQ_ENABLED` が未設定の場合、デモ用サンプルデータを使用します（API不要）。

---

## デモモード

認証情報なしでも動作します。`WORKIQ_ENABLED=true` 未設定の場合、
以下のサンプルデータを使用したデモ動作を行います：

- 中村さんの自治体調整メール（高さ制限15m、色指定、住民説明会済み）
- 鈴木さんのRF設計検討結果（20m必要、15mで85%カバレッジ、スモールセル2基代替案）
- A市基地局設置計画 技術検討会議 議事録
- スモールセル設置基準ドキュメント

---

## プロジェクト構成

```
.
├── backend/
│   ├── main.py                 # FastAPI app (WebSocket + REST)
│   ├── agent.py                # Copilot SDK エージェント
│   ├── requirements.txt
│   ├── tools/
│   │   ├── __init__.py
│   │   └── workiq_tool.py      # Work IQ MCP ツール（デモモード付き）
│   └── skills/
│       ├── __init__.py
│       └── site_approval.py    # エージェント システムプロンプト
├── frontend/
│   ├── package.json
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # 2ペインレイアウト
│   │   └── components/
│   │       ├── ChatPanel.tsx   # 左側: チャット UI
│   │       └── ReportPanel.tsx # 右側: 承認レポート表示
│   └── .env.local.example
├── .env.example
└── README.md
```

---

## 参考

- [copilot-work-iq](https://github.com/ishidahra01/copilot-work-iq) — 参考実装
- [GitHub Copilot SDK](https://github.com/github/copilot-sdk-python)
- [Work IQ MCP](https://github.com/microsoft/work-iq-mcp)
