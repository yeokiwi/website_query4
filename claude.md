## Website Change Monitor

### Project Overview

A responsive single-page web application that monitors websites for recent changes. Users can check individual URLs or batch-process a list from a `website.md` file. The application uses an LLM with autonomous web browsing capabilities (`web_search` and `fetch_url` tools) to analyze each site and produce structured change reports saved as individual markdown files.

The three primary workflows are:
1. **Single URL Query** — Enter a URL, click Request, get a streamed analysis in the chat UI
2. **Batch Monitor** — Load URLs from `website.md`, process all of them sequentially, write each result to a markdown report file in `/reports`
3. **Website List Editor** — View, add, remove, and reorder URLs in `website.md` directly from the UI without manual file editing

Both workflows use the same prompt template, the same agentic tool-use loop, and the same LLM configuration.

---

### Tech Stack

- **Frontend:** React (with Vite) + Tailwind CSS
- **Backend:** Node.js + Express
- **LLM:** Anthropic Claude API (tool use / function calling)
- **Web Search:** Brave Search API or SerpAPI
- **URL Fetching:** Axios + Cheerio (HTML parsing) + Turndown (markdown conversion)
- **Streaming:** Server-Sent Events (SSE)

---

### Core Concepts

#### Prompt Template (shared by single and batch modes)

This is the message sent to the LLM for each URL, with `[URL]` replaced by the target:

```
I need you to examine [URL] and focus specifically on:
- What's new or changed in the last 30 days?
- Any announcements, blog posts, or news from the past month
- Updates to products, services, or features
- Changes to pricing, terms of service, or policies
Please distinguish between what you can confirm as recent vs. what appears to be recent based on dates or context.
```

#### Agentic Tool-Use Loop

The backend implements a multi-step loop for every LLM request:

1. Send messages + tool definitions to the LLM
2. If the LLM returns a `tool_use` block, execute the tool server-side
3. Append the `tool_result` to the message history
4. Re-send the updated history back to the LLM
5. Repeat until the LLM returns a final `end_turn` text response

This loop is the same for single URL queries and for each URL in a batch run. Each invocation gets a fresh conversation context.

#### System Prompt (configurable in `.env`)

```
You are a helpful assistant with the ability to browse the web.
When a user asks about current events, recent data, or specific URLs,
use the web_search or fetch_url tools to retrieve up-to-date information
before answering. Always cite your sources by including the URL in your response.
```

---

### Tool Definitions

Passed to the LLM on every request:

```json
[
  {
    "name": "web_search",
    "description": "Search the web for current information using a query string. Use this when the user asks about recent events, news, prices, or anything that may have changed.",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query string"
        },
        "num_results": {
          "type": "integer",
          "description": "Number of results to return (default: 5, max: 10)"
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "fetch_url",
    "description": "Fetch and extract the readable text content of a webpage by URL. Use this to read the full content of a specific page, article, or document.",
    "input_schema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "The full URL of the page to fetch (must include https://)"
        },
        "extract_mode": {
          "type": "string",
          "enum": ["text", "markdown"],
          "description": "How to extract content: 'text' for plain text, 'markdown' for structured markdown"
        }
      },
      "required": ["url"]
    }
  }
]
```

#### Tool Execution Handlers

`web_search(query, num_results)`:
- Call Brave Search API / SerpAPI with the query
- Return an array of `{ title, url, snippet }` objects
- Cap content at a configurable token limit to avoid oversized context

`fetch_url(url, extract_mode)`:
- Fetch raw HTML with Axios
- Strip navigation, ads, and boilerplate with Cheerio — extract main content only
- Convert to plain text or Turndown-rendered Markdown depending on `extract_mode`
- Truncate to a configurable max character limit (default: 8,000 chars)

---

### Backend

#### Service Layer

| File | Responsibility |
|---|---|
| `server/services/llmService.js` | Anthropic SDK client, model config, tool definitions, `createMessage()` |
| `server/services/webSearchService.js` | `webSearch(query, numResults)` — Brave or SerpAPI |
| `server/services/fetchUrlService.js` | `fetchUrl(url, extractMode)` — Axios + Cheerio + Turndown, URL blocklist |

#### API Endpoints

**`POST /api/chat`** — Single query (interactive chat + single URL query)
- Accepts: `{ messages: [{ role, content }, ...] }`
- Runs the agentic tool-use loop
- Streams to frontend via SSE events: `text`, `tool_start`, `tool_end`, `done`, `error`

**`GET /api/batch-monitor/websites`** — List monitored URLs
- Reads and parses `website.md` from the project root
- Returns: `{ urls: ["https://example.com", ...] }`

**`PUT /api/batch-monitor/websites`** — Overwrite the full URL list
- Accepts: `{ urls: ["https://example.com", ...] }`
- Validates every URL (must be valid, HTTPS, not on the blocklist)
- Writes the list back to `website.md`, preserving the `# Websites to monitor` header comment
- Returns: `{ urls: [...] }` (the saved list, confirming the write)
- Returns `400` with `{ error, invalidUrls }` if any URL fails validation

**`POST /api/batch-monitor/websites`** — Add a single URL
- Accepts: `{ url: "https://example.com" }`
- Validates the URL, checks for duplicates
- Appends to `website.md`
- Returns: `{ urls: [...] }` (the full updated list)
- Returns `400` if invalid, `409` if duplicate

**`DELETE /api/batch-monitor/websites`** — Remove a single URL
- Accepts: `{ url: "https://example.com" }`
- Removes the matching line from `website.md`
- Returns: `{ urls: [...] }` (the full updated list)
- Returns `404` if the URL is not in the list

**`POST /api/batch-monitor`** — Batch run
- Reads `website.md`, processes each URL through the agentic loop with the shared prompt template
- Each URL gets a fresh conversation context (no cross-contamination)
- Writes each result to a markdown report file in `/reports`
- Streams progress via SSE events:
  - `batch_start`: `{ total }`
  - `batch_item_start`: `{ index, url }`
  - `batch_item_text`: `{ index, url, text }`
  - `batch_item_tool_start` / `batch_item_tool_end`: tool activity for current URL
  - `batch_item_done`: `{ index, url, filename }`
  - `batch_item_error`: `{ index, url, error }`
  - `batch_done`: `{ total, succeeded, failed }`

**`GET /api/reports`** — List generated reports
- Returns: `{ reports: [{ filename, url, timestamp, size }, ...] }`

**`GET /api/reports/:filename`** — Read a specific report
- Returns the markdown content of the report file

**`GET /api/health`** — Health check

#### Security & Safety

- URL blocklist: block `localhost`, `127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `169.254.*`, `[::1]`, `fc*`, `fd*`, `fe80*`
- HTTPS only — reject non-`https://` URLs
- Rate limit tool calls per turn (configurable, default: 10) to prevent infinite loops
- All API keys in `.env`, never exposed to the frontend
- Request timeouts on LLM calls (30s) and URL fetches (15s)

#### Error Handling

- Tool failures return structured error results to the LLM so it can acknowledge and try alternatives
- HTTP errors surface to the frontend with user-friendly messages
- Batch mode: individual URL failures log the error, write a report with `status: error`, and continue to the next URL

---

### `website.md` Format

Located at the project root. One URL per line. Comments (`#`) and empty lines are ignored. This file can be edited manually or managed through the in-app Website List Editor.

```
# Websites to monitor
https://example.com
https://openai.com/blog
https://developer.chrome.com
```

When saved via the API, the file always starts with the `# Websites to monitor` header comment followed by one URL per line, with no trailing blank lines.

---

### Report Output

Each URL's LLM response is saved as a markdown file in `/reports`.

**Filename format:** `{domain}-{YYYY-MM-DD}.md` (e.g., `example.com-2026-03-01.md`)
If a file with the same name exists, append a numeric suffix: `example.com-2026-03-01-2.md`

**File structure:**
```markdown
---
url: https://example.com
date: 2026-03-01T12:00:00Z
status: success
---

# Website Change Report: example.com

[LLM response content here]
```

On error, the file is written with `status: error` and the error message in the body.

---

### Frontend

#### Layout (top to bottom)

1. **Header** — App title, dark/light mode toggle, Batch Monitor button, Reports button, Clear Chat button
2. **URL Query Bar** — URL input + Request button (single-site monitoring)
3. **Message List** — Scrollable chat thread (user messages, assistant responses, inline tool activity cards)
4. **Chat Input** — Fixed-to-bottom freeform textarea

#### Header

- App title: "LLM Chat" / "with web browsing"
- Dark/light mode toggle (persisted to `localStorage`)
- "Batch Monitor" button — opens the batch panel (which contains the Website List Editor)
- "Reports" button — opens the reports list
- "Clear Chat" button — resets conversation history

#### URL Query Bar (`UrlQueryBar`)

- Single-line URL input with link icon, placeholder `https://example.com`
- **Request** button with search icon
- Auto-prepends `https://` if user omits the protocol
- On submit: constructs the shared prompt template with the URL inserted, sends it as a chat message
- The prompt appears in the chat thread as a normal user message
- Disabled while any request is in progress

#### Chat Interface

**Message bubbles:**
- User messages: blue bubble, right-aligned
- Assistant messages: white/dark bubble, left-aligned, with markdown rendering (react-markdown + remark-gfm + rehype-highlight)
- Each shows role label ("You" / "Assistant") and timestamp

**Tool activity cards** (inline in assistant messages):
- Collapsible card showing tool name, query/URL, status (`searching...` → `done` / `failed`)
- Expandable to show truncated result preview
- Clickable URLs open in new tab

**Typing indicator:** Animated dots shown while awaiting LLM response

**Auto-scroll** to latest message on new entries

#### Chat Input (`ChatInput`)

- Fixed to bottom, textarea that auto-resizes
- Enter to send, Shift+Enter for newline
- Disabled while a request or batch run is in progress
- Clears after submission

#### Session Management

- Full conversation history maintained in React state
- Complete history passed on each API call for multi-turn context
- Persisted to `localStorage`, restored on page load
- "Clear Chat" resets thread and storage

#### Batch Monitor Panel

- Triggered by "Batch Monitor" button in header
- Shows list of URLs loaded from `website.md` (fetched via `GET /api/batch-monitor/websites`)
- Includes an "Edit List" button that opens the Website List Editor (see below)
- "Run All" button starts processing
- Per-URL status: `pending` → `monitoring...` → `done` / `failed`
- Progress counter (e.g., "3 / 7 completed")
- Links to view/download completed reports
- Cancellable mid-run, preserving reports already written
- While running, URL Query Bar, Chat Input, and Edit List are disabled
- If `website.md` is missing or empty, shows instructions and an "Add URLs" button that opens the editor

#### Website List Editor (`WebsiteListEditor`)

An inline editor panel for managing the URLs in `website.md` without leaving the app.

**Access:**
- "Edit List" button inside the Batch Monitor Panel
- Also reachable from the empty-state message when `website.md` is missing or empty

**Layout:**
- Editable list of current URLs, each row showing:
  - The URL as an editable text input
  - A drag handle for reordering (or up/down arrow buttons on mobile)
  - A delete button (trash icon) to remove the row
- "Add URL" button at the bottom appends a new empty row
- A "Save" button persists changes via `PUT /api/batch-monitor/websites`
- A "Cancel" button discards unsaved edits and closes the editor

**Behavior:**
- On open: fetches the current list from `GET /api/batch-monitor/websites` and populates the rows
- Adding a URL: appends a new empty input row; user types or pastes the URL
- Removing a URL: removes the row immediately from the local list (not persisted until Save)
- Reordering: drag-and-drop or arrow buttons to move a URL up/down in the list
- On Save:
  - Auto-prepends `https://` to any URL missing a protocol
  - Strips empty rows
  - Sends the full list to `PUT /api/batch-monitor/websites`
  - If the backend returns validation errors, highlights the invalid rows with an error message (e.g., "Invalid URL", "Private address blocked")
  - On success, closes the editor and refreshes the Batch Monitor Panel list
- On Cancel: discards all local edits, closes the editor
- Disabled while a batch run is in progress

**Validation (client-side, before submit):**
- Each URL must be non-empty after trimming
- Basic URL format check (must start with a valid domain or `https://`)
- Duplicate detection — highlights duplicate rows with a warning

#### Reports Panel

- Triggered by "Reports" button in header
- Lists all generated report files (fetched via `GET /api/reports`)
- Each entry shows: domain, date, file size
- Clicking an entry renders the report as markdown in a modal or the chat area

#### Empty State

When no messages exist, the main area shows:
- Globe icon
- "Website Change Monitor" heading
- Instruction to enter a URL and click Request
- Note that freeform chat is also available

---

### Non-Functional Requirements

- Mobile-responsive layout (320px and wider)
- All configurable values in `.env`: API keys, model name, system prompt, max tokens, temperature, tool call limit, fetch character limit, reports directory
- Clean service layer separation (see Service Layer table above)
- Request timeout handling for LLM calls and URL fetches

---

### Configuration (`.env`)

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | (required) |
| `MODEL_NAME` | Claude model to use | `claude-sonnet-4-20250514` |
| `MAX_TOKENS` | Max tokens per LLM response | `4096` |
| `TEMPERATURE` | LLM temperature | `0.7` |
| `SYSTEM_PROMPT` | System prompt | (see above) |
| `SEARCH_PROVIDER` | `brave` or `serpapi` | `brave` |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key | - |
| `SERPAPI_API_KEY` | SerpAPI key | - |
| `MAX_TOOL_CALLS_PER_TURN` | Max tool calls per conversation turn | `10` |
| `FETCH_MAX_CHARS` | Max chars when fetching a URL | `8000` |
| `REPORTS_DIR` | Directory for report output | `./reports` |
| `PORT` | Backend server port | `3001` |

---

### Deliverables

```
├── client/                       # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── UrlQueryBar.jsx
│   │   │   ├── MessageList.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── ToolActivityCard.jsx
│   │   │   ├── TypingIndicator.jsx
│   │   │   ├── ChatInput.jsx
│   │   │   ├── BatchMonitorPanel.jsx
│   │   │   ├── WebsiteListEditor.jsx
│   │   │   └── ReportsPanel.jsx
│   │   ├── hooks/
│   │   │   └── useChat.js
│   │   ├── utils/
│   │   │   ├── storage.js
│   │   │   └── formatTime.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/
│   ├── services/
│   │   ├── llmService.js
│   │   ├── webSearchService.js
│   │   └── fetchUrlService.js
│   ├── index.js
│   └── package.json
├── reports/                      # Generated report files
├── website.md                    # URLs to monitor
├── .env.example
├── .gitignore
└── README.md
```
