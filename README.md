# Website Change Monitor

A responsive single-page web application that monitors websites for recent changes. Uses an LLM with autonomous web browsing capabilities to analyze sites and produce structured change reports.

## Features

- **Single URL Query** — Enter a URL, click Request, get a streamed analysis
- **Batch Monitor** — Load URLs from `website.md`, process all sequentially, save markdown reports
- **Website List Editor** — Manage monitored URLs directly from the UI
- **Reports** — View generated change reports
- **Chat** — Freeform conversation with web-browsing AI assistant
- **Dark Mode** — Toggle between light and dark themes

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

## Project Structure

```
├── client/          # React frontend (Vite + Tailwind CSS)
├── server/          # Node.js + Express backend
├── reports/         # Generated report files
├── website.md       # URLs to monitor
└── .env.example     # Configuration template
```
