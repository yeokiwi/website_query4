# Website Change Monitor

A single-page app that monitors websites for recent changes. Users query individual URLs or batch-process a list from `website.md`. An LLM with `web_search` and `fetch_url` tool access analyzes each site and produces structured markdown reports saved under `/reports`.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| LLM | Anthropic Claude API (tool use via SSE) |
| Web Search | Brave Search API or SerpAPI |
| URL Fetching | Axios + Cheerio + Turndown |

---

## Project Structure

```
├── client/src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── LoginPage.jsx
│   │   ├── UrlQueryBar.jsx
│   │   ├── MessageList.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── ToolActivityCard.jsx
│   │   ├── TypingIndicator.jsx
│   │   ├── ChatInput.jsx
│   │   ├── BatchMonitorPanel.jsx
│   │   ├── WebsiteListEditor.jsx
│   │   └── ReportsPanel.jsx
│   ├── hooks/useChat.js
│   ├── utils/
│   │   ├── authFetch.js
│   │   ├── storage.js
│   │   └── formatTime.js
│   └── App.jsx
├── server/
│   ├── services/
│   │   ├── llmService.js        # Anthropic SDK, tool definitions, agentic loop
│   │   ├── webSearchService.js  # Brave / SerpAPI integration
│   │   └── fetchUrlService.js   # Axios + Cheerio + Turndown, URL blocklist
│   └── index.js                 # Express routes
├── website.md                   # URLs to monitor (one per line)
├── reports/                     # Generated markdown reports
├── render.yaml
└── .env.example
```

---

## Core Workflows

1. **Single URL Query** — user enters a URL, backend runs the agentic loop, streams result to chat UI
2. **Batch Monitor** — loads URLs from `website.md`, processes each sequentially, writes a report per URL to `/reports`
3. **Website List Editor** — in-app CRUD for `website.md` without manual file editing

All three use the same prompt template and agentic tool-use loop.

---

## Agentic Tool-Use Loop

Each LLM request goes through a multi-step loop in `llmService.js`:

1. Send messages + tool definitions to Claude
2. If response contains a `tool_use` block, execute the tool server-side
3. Append `tool_result` to message history
4. Re-send updated history to Claude
5. Repeat until Claude returns a final `end_turn` text response

Each request (single or batch item) gets a **fresh conversation context**.

### Tools

| Tool | Description |
|---|---|
| `web_search(query, num_results?)` | Brave/SerpAPI → returns `[{ title, url, snippet }]` |
| `fetch_url(url, extract_mode?)` | Fetch + Cheerio strip + Turndown → plain text or markdown, max 8k chars |

### Prompt Template

```
I need you to examine [URL] and focus specifically on:
- What's new or changed in the last 30 days?
- Any announcements, blog posts, or news from the past month
- Updates to products, services, or features
- Changes to pricing, terms of service, or policies
Please distinguish between what you can confirm as recent vs. what appears to be recent based on dates or context.
```

---

## API Endpoints

### Chat

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Single query — runs agentic loop, streams SSE (`text`, `tool_start`, `tool_end`, `done`, `error`) |

### Batch Monitor

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/batch-monitor/websites` | List URLs from `website.md` |
| `PUT` | `/api/batch-monitor/websites` | Overwrite full URL list |
| `POST` | `/api/batch-monitor/websites` | Add a single URL (409 if duplicate) |
| `DELETE` | `/api/batch-monitor/websites` | Remove a single URL |
| `POST` | `/api/batch-monitor` | Run batch — streams SSE progress per URL |

**Batch SSE events:** `batch_start`, `batch_item_start`, `batch_item_text`, `batch_item_tool_start`, `batch_item_tool_end`, `batch_item_done`, `batch_item_error`, `batch_done`

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports` | List report files `[{ filename, url, timestamp, size }]` |
| `GET` | `/api/reports/:filename` | Read report markdown content |
| `GET` | `/api/health` | Health check |

---

## Data Formats

### `website.md`

One URL per line; `#` lines and blank lines are ignored. Always starts with `# Websites to monitor` header when saved via the API.

### Report Files (`/reports`)

**Filename:** `{domain}-{YYYY-MM-DD}.md` — numeric suffix if duplicate (e.g., `example.com-2026-03-01-2.md`)

```markdown
---
url: https://example.com
date: 2026-03-01T12:00:00Z
status: success|error
---

# Website Change Report: example.com

[LLM response]
```

---

## Security

- URL blocklist: rejects `localhost`, RFC-1918 ranges, link-local, and IPv6 private ranges
- HTTPS-only URLs enforced at API and tool level
- Max tool calls per turn (default: 10) to prevent infinite loops
- Timeouts: 30s for LLM calls, 15s for URL fetches
- All API keys in `.env`, never sent to the frontend

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Anthropic API key |
| `MODEL_NAME` | `claude-sonnet-4-20250514` | Claude model |
| `MAX_TOKENS` | `4096` | Max tokens per response |
| `TEMPERATURE` | `0.7` | LLM temperature |
| `SYSTEM_PROMPT` | (see llmService.js) | System prompt override |
| `SEARCH_PROVIDER` | `brave` | `brave` or `serpapi` |
| `BRAVE_SEARCH_API_KEY` | — | Brave Search key |
| `SERPAPI_API_KEY` | — | SerpAPI key |
| `MAX_TOOL_CALLS_PER_TURN` | `10` | Tool call limit per turn |
| `FETCH_MAX_CHARS` | `8000` | Max chars from URL fetch |
| `REPORTS_DIR` | `./reports` | Report output directory |
| `PORT` | `3001` | Backend port |
