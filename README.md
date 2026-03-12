# Website Change Monitor

A responsive single-page web application that monitors websites for recent changes. Uses an LLM with autonomous web browsing capabilities (web search and URL fetching) to analyze sites and produce structured markdown change reports. The application supports both single-URL queries and batch processing of multiple websites, with results streamed in real time via Server-Sent Events.

## Features

- **Single URL Query** — Enter a URL, click Request, get a streamed analysis
- **Batch Monitor** — Load URLs from `website.md`, process all sequentially, save markdown reports
- **Custom Prompts** — Optionally customise the LLM prompt per website; uses a sensible default when left blank
- **Website List Editor** — Manage monitored URLs and their custom prompts directly from the UI
- **Reports** — View, read, and delete generated change reports with markdown rendering
- **Chat** — Freeform conversation with web-browsing AI assistant
- **Dark Mode** — Toggle between light and dark themes
- **Dual LLM Support** — Switch between Anthropic Claude and DeepSeek via config
- **Date Picker** — Set the reference date used in the monitoring prompt

## Design

### Architecture

```
┌─────────────────────────┐       SSE / REST        ┌──────────────────────────────┐
│    React Frontend       │ ◄──────────────────────► │     Express Backend          │
│  (Vite + Tailwind CSS)  │                          │     (Node.js, ES modules)    │
│                         │                          │                              │
│  App.jsx                │                          │  index.js                    │
│  ├─ Header              │                          │  ├─ /api/chat (SSE)          │
│  ├─ UrlQueryBar         │                          │  ├─ /api/batch-monitor (SSE) │
│  ├─ BatchMonitorPanel   │                          │  ├─ /api/batch-monitor/      │
│  │  └─ WebsiteListEditor│                          │  │   websites (CRUD)         │
│  ├─ ReportsPanel        │                          │  ├─ /api/reports (CRUD)      │
│  ├─ MessageList         │                          │  └─ /api/config              │
│  │  └─ MessageBubble    │                          │                              │
│  │     └─ ToolActivity  │                          │  Services:                   │
│  ├─ ChatInput           │                          │  ├─ llmService.js            │
│  └─ TypingIndicator     │                          │  ├─ webSearchService.js      │
└─────────────────────────┘                          │  └─ fetchUrlService.js       │
                                                     └──────────────────────────────┘
```

### Agentic Loop

The backend runs an autonomous tool-use loop for each query:

1. Send the user prompt + tool definitions to the LLM
2. If the LLM calls `web_search` or `fetch_url`, execute the tool and return results
3. Repeat until the LLM produces a final text response or the tool-call limit is reached
4. Stream all text and tool activity to the frontend via SSE events

### Custom Prompts

Each website in the batch list can have an optional custom LLM prompt. Custom prompts are stored in `website-prompts.json` (separate from the URL list in `website.md`). The prompt template supports two placeholders:

- `[url]` — replaced with the website URL
- `[date]` — replaced with the current date

When no custom prompt is set for a URL, the default prompt is used:

> The current date is [date]. I need you to examine [url] and focus specifically on:
> - What's new or changed in the last 30 days?
> - Any announcements, blog posts, or news from the past month
> - Updates to products, services, or features
> - Changes to pricing, terms of service, or policies
> Please distinguish between what you can confirm as recent vs. what appears to be recent based on dates or context.

### Data Storage

| File | Purpose |
|---|---|
| `website.md` | List of URLs to monitor (one per line) |
| `website-prompts.json` | Per-URL custom prompts (keyed by URL) |
| `reports/` | Generated markdown reports with YAML frontmatter |

## Local Setup

1. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies and build:
   ```bash
   npm run build
   ```

3. Start the server:
   ```bash
   npm start
   ```

   The app will be available at `http://localhost:3001`.

### Development

Run the frontend dev server and backend separately:

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

The frontend dev server runs on port 5173 and proxies API requests to port 3001.

## Deploy to Render.com

### Option A: Blueprint (recommended)

1. Push this repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Blueprint**
3. Connect your GitHub repo and select this repository
4. Render reads `render.yaml` and creates the service automatically
5. In the Render dashboard, set the required environment variables:
   - `LLM_PROVIDER` — `anthropic` or `deepseek`
   - `ANTHROPIC_API_KEY` — your Anthropic API key (if using Anthropic)
   - `DEEPSEEK_API_KEY` — your DeepSeek API key (if using DeepSeek)
   - `SEARCH_PROVIDER` — `brave` or `serpapi`
   - `BRAVE_SEARCH_API_KEY` or `SERPAPI_API_KEY` — your search API key

The blueprint configures a **Persistent Disk** at `/data` so that `website.md` and generated reports survive redeployments.

### Option B: Manual setup

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
4. Add environment variables (see list above)
5. (Optional) Add a **Persistent Disk**:
   - Mount path: `/data`
   - Set env vars `REPORTS_DIR=/data/reports` and `WEBSITE_FILE=/data/website.md`

### Ephemeral vs. Persistent storage

Without a persistent disk, `website.md` edits, custom prompts, and generated reports are lost on each redeploy. For production use, attach a persistent disk and set the `REPORTS_DIR`, `WEBSITE_FILE`, and `PROMPTS_FILE` env vars to paths on that disk (e.g., `/data/reports`, `/data/website.md`, and `/data/website-prompts.json`).

## Configuration

See `.env.example` for all configuration options including API keys, model settings, and limits.

| Variable | Description | Default |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` or `deepseek` | `anthropic` |
| `ANTHROPIC_API_KEY` | Anthropic API key | (required if provider=anthropic) |
| `MODEL_NAME` | Claude model to use | `claude-sonnet-4-20250514` |
| `DEEPSEEK_API_KEY` | DeepSeek API key | (required if provider=deepseek) |
| `DEEPSEEK_MODEL` | DeepSeek model | `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | DeepSeek API base URL | `https://api.deepseek.com` |
| `SEARCH_PROVIDER` | `brave` or `serpapi` | `brave` |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key | - |
| `SERPAPI_API_KEY` | SerpAPI key | - |
| `MAX_TOKENS` | Max tokens per LLM response | `4096` |
| `TEMPERATURE` | LLM temperature | `0.7` |
| `MAX_TOOL_CALLS_PER_TURN` | Max tool calls per turn | `10` |
| `FETCH_MAX_CHARS` | Max chars when fetching a URL | `8000` |
| `REPORTS_DIR` | Directory for report output | `./reports` |
| `WEBSITE_FILE` | Path to the website list file | `./website.md` |
| `PROMPTS_FILE` | Path to the custom prompts JSON file | `./website-prompts.json` |
| `PORT` | Server port | `3001` |

## Project Structure

```
├── client/                  # React frontend (Vite + Tailwind CSS)
│   └── src/
│       ├── components/      # UI components (App, BatchMonitorPanel, WebsiteListEditor, etc.)
│       ├── hooks/           # useChat hook (SSE stream + state management)
│       └── utils/           # localStorage helpers, time formatting
├── server/                  # Node.js + Express backend
│   ├── index.js             # Routes, agentic loop, batch processing, report I/O
│   └── services/            # llmService, webSearchService, fetchUrlService
├── reports/                 # Generated markdown report files
├── website.md               # URLs to monitor (one per line)
├── website-prompts.json     # Per-URL custom LLM prompts (auto-created)
├── render.yaml              # Render.com blueprint
├── package.json             # Root scripts (build + start)
└── .env.example             # Configuration template
```
