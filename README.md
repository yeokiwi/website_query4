# Website Change Monitor

A responsive single-page web application that monitors websites for recent changes. Uses an LLM with autonomous web browsing capabilities to analyze sites and produce structured change reports.

## Features

- **Single URL Query** — Enter a URL, click Request, get a streamed analysis
- **Batch Monitor** — Load URLs from `website.md`, process all sequentially, save markdown reports
- **Website List Editor** — Manage monitored URLs directly from the UI
- **Reports** — View and delete generated change reports
- **Chat** — Freeform conversation with web-browsing AI assistant
- **Dark Mode** — Toggle between light and dark themes
- **Dual LLM Support** — Switch between Anthropic Claude and DeepSeek via config
- **Date Picker** — Set the reference date used in the monitoring prompt

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

Without a persistent disk, `website.md` edits and generated reports are lost on each redeploy. For production use, attach a persistent disk and set the `REPORTS_DIR` and `WEBSITE_FILE` env vars to paths on that disk (e.g., `/data/reports` and `/data/website.md`).

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
| `PORT` | Server port | `3001` |

## Project Structure

```
├── client/          # React frontend (Vite + Tailwind CSS)
├── server/          # Node.js + Express backend
├── reports/         # Generated report files
├── website.md       # URLs to monitor
├── render.yaml      # Render.com blueprint
├── package.json     # Root scripts (build + start)
└── .env.example     # Configuration template
```
