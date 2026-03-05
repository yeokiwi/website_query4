# Website Change Monitor

A responsive single-page web application that monitors websites for recent changes. Uses an LLM with autonomous web browsing capabilities to analyze sites and produce structured change reports.

## Features

- **Single URL Query** — Enter a URL, click Request, get a streamed analysis
- **Batch Monitor** — Load URLs from `website.md`, process all sequentially, save markdown reports
- **Website List Editor** — Manage monitored URLs directly from the UI
- **Reports** — View generated change reports
- **Chat** — Freeform conversation with web-browsing AI assistant
- **Dark Mode** — Toggle between light and dark themes
- **Authentication** — Login with configurable username/password, change password from the UI
- **Export PDF** — Export individual reports to PDF via the browser print dialog

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. Build the frontend:
   ```bash
   cd client && npm run build
   ```

4. Start the server:
   ```bash
   cd server && npm start
   ```

   The app will be available at `http://localhost:3001`.

### Development

Run the frontend dev server and backend separately:

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

The frontend dev server runs on port 5173 and proxies API requests to port 3001.

## Configuration

See `.env.example` for all configuration options including API keys, model settings, and limits.

## Deploying to Render.com

### Option A: Blueprint (recommended)

1. Push this repo to GitHub.
2. In the Render dashboard, click **New > Blueprint**.
3. Select your repository — Render will detect the `render.yaml` file automatically.
4. Fill in the environment variables when prompted (API keys, auth credentials, etc.).
5. Click **Apply** to deploy.

The blueprint configures a web service with a 1 GB persistent disk at `/data` for storing `website.md` and generated reports.

### Option B: Manual setup

1. In the Render dashboard, click **New > Web Service** and connect your repo.
2. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Runtime** | Node |
   | **Build Command** | `npm run install:all && npm run build` |
   | **Start Command** | `npm start` |

3. Add a **Disk** with mount path `/data` and size 1 GB.
4. Set these **Environment Variables**:

   | Variable | Description |
   |----------|-------------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `WEBSITE_FILE` | `/data/website.md` |
   | `REPORTS_DIR` | `/data/reports` |
   | `LLM_PROVIDER` | `anthropic` or `deepseek` |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key (if using Anthropic) |
   | `MODEL_NAME` | e.g. `claude-sonnet-4-20250514` |
   | `DEEPSEEK_API_KEY` | Your DeepSeek API key (if using DeepSeek) |
   | `SEARCH_PROVIDER` | `brave` or `serpapi` |
   | `BRAVE_SEARCH_API_KEY` | Your Brave Search key (if using Brave) |
   | `SERPAPI_API_KEY` | Your SerpAPI key (if using SerpAPI) |
   | `AUTH_USERNAME` | Login username (default: `admin`) |
   | `AUTH_PASSWORD` | Login password (default: `dso12345`) |

5. Click **Deploy**.

### Notes

- The persistent disk ensures reports and the website list survive redeployments.
- Auth session tokens are stored in memory and will reset on each deploy/restart. Users will simply need to log in again.
- The free plan on Render spins down after inactivity; the first request after idle may take ~30 seconds.

## Project Structure

```
├── client/          # React frontend (Vite + Tailwind CSS)
├── server/          # Node.js + Express backend
├── reports/         # Generated report files
├── website.md       # URLs to monitor
├── render.yaml      # Render.com deployment blueprint
├── package.json     # Root scripts for unified build/start
└── .env.example     # Configuration template
```
