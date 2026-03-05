import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMessage, getProviderInfo } from './services/llmService.js';
import { webSearch } from './services/webSearchService.js';
import { fetchUrl, isBlockedUrl } from './services/fetchUrlService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WEBSITE_FILE = path.resolve(process.env.WEBSITE_FILE || path.join(PROJECT_ROOT, 'website.md'));
const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || path.join(PROJECT_ROOT, 'reports'));
const MAX_TOOL_CALLS = parseInt(process.env.MAX_TOOL_CALLS_PER_TURN || '10', 10);
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
let currentPassword = process.env.AUTH_PASSWORD || 'dso12345';

// Active session tokens (in-memory; cleared on server restart)
const activeSessions = new Set();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend build in production
const clientDist = path.join(PROJECT_ROOT, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── Auth ─────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_USERNAME && password === currentPassword) {
    const token = crypto.randomUUID();
    activeSessions.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) activeSessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && activeSessions.has(token)) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ authenticated: false });
});

app.post('/api/auth/change-password', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { currentPassword: curr, newPassword } = req.body;
  if (curr !== currentPassword) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }
  currentPassword = newPassword;
  res.json({ ok: true });
});

// Auth middleware — protect all /api/* routes below this point
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && activeSessions.has(token)) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout' || req.path === '/auth/check' || req.path === '/auth/change-password' || req.path === '/health') {
    return next();
  }
  requireAuth(req, res, next);
});

// ── Helpers ──────────────────────────────────────────────

function readWebsiteFile() {
  if (!fs.existsSync(WEBSITE_FILE)) return [];
  const content = fs.readFileSync(WEBSITE_FILE, 'utf-8');
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function writeWebsiteFile(urls) {
  const content = '# Websites to monitor\n' + urls.join('\n') + '\n';
  fs.writeFileSync(WEBSITE_FILE, content, 'utf-8');
}

function validateUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return 'URL must use HTTPS';
    if (isBlockedUrl(urlString)) return 'Private address blocked';
    return null;
  } catch {
    return 'Invalid URL';
  }
}

async function executeTool(name, input) {
  if (name === 'web_search') {
    const results = await webSearch(input.query, input.num_results);
    return JSON.stringify(results);
  }
  if (name === 'fetch_url') {
    const content = await fetchUrl(input.url, input.extract_mode);
    return content;
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function getPromptForUrl(url, currentDate) {
  const dateLine = currentDate ? `The current date is ${currentDate}. ` : '';
  return `${dateLine}I need you to examine ${url} and focus specifically on:
- What's new or changed in the last 30 days?
- Any announcements, blog posts, or news from the past month
- Updates to products, services, or features
- Changes to pricing, terms of service, or policies
Please distinguish between what you can confirm as recent vs. what appears to be recent based on dates or context.`;
}

function generateReportFilename(url) {
  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = 'unknown';
  }
  const date = new Date().toISOString().slice(0, 10);
  let filename = `${domain}-${date}.md`;
  let counter = 2;
  while (fs.existsSync(path.join(REPORTS_DIR, filename))) {
    filename = `${domain}-${date}-${counter}.md`;
    counter++;
  }
  return filename;
}

function writeReport(filename, url, content, status = 'success') {
  const date = new Date().toISOString();
  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = 'unknown';
  }
  const report = `---
url: ${url}
date: ${date}
status: ${status}
---

# Website Change Report: ${domain}

${content}
`;
  fs.writeFileSync(path.join(REPORTS_DIR, filename), report, 'utf-8');
}

// ── Agentic loop ─────────────────────────────────────────

async function runAgenticLoop(messages, onText, onToolStart, onToolEnd) {
  let toolCallCount = 0;

  while (true) {
    let response;
    try {
      response = await createMessage(messages);
    } catch (err) {
      throw new Error(`LLM API error: ${err.message}`);
    }

    let hasToolUse = false;
    const toolResults = [];
    let textContent = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
        if (onText) onText(block.text);
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        toolCallCount++;

        if (toolCallCount > MAX_TOOL_CALLS) {
          const errMsg = 'Maximum tool call limit reached';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: errMsg,
            is_error: true,
          });
          if (onToolStart) onToolStart(block.name, block.input);
          if (onToolEnd) onToolEnd(block.name, errMsg, true);
          continue;
        }

        if (onToolStart) onToolStart(block.name, block.input);

        let result;
        let isError = false;
        try {
          result = await executeTool(block.name, block.input);
        } catch (err) {
          result = `Error: ${err.message}`;
          isError = true;
        }

        if (onToolEnd) onToolEnd(block.name, result, isError);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
          is_error: isError,
        });
      }
    }

    if (!hasToolUse || response.stop_reason === 'end_turn') {
      return textContent;
    }

    // Append assistant message and tool results for next iteration
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }
}

// ── POST /api/chat ───────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const conversationMessages = [...messages];

  try {
    await runAgenticLoop(
      conversationMessages,
      (text) => sseWrite(res, 'text', { text }),
      (name, input) => sseWrite(res, 'tool_start', { name, input }),
      (name, result, isError) =>
        sseWrite(res, 'tool_end', {
          name,
          result: typeof result === 'string' ? result.slice(0, 500) : result,
          isError,
        })
    );
    sseWrite(res, 'done', {});
  } catch (err) {
    sseWrite(res, 'error', { error: err.message });
  }

  res.end();
});

// ── GET /api/batch-monitor/websites ──────────────────────

app.get('/api/batch-monitor/websites', (req, res) => {
  const urls = readWebsiteFile();
  res.json({ urls });
});

// ── PUT /api/batch-monitor/websites ──────────────────────

app.put('/api/batch-monitor/websites', (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  const invalidUrls = [];
  for (const url of urls) {
    const err = validateUrl(url);
    if (err) invalidUrls.push({ url, error: err });
  }

  if (invalidUrls.length > 0) {
    return res.status(400).json({ error: 'Some URLs are invalid', invalidUrls });
  }

  writeWebsiteFile(urls);
  res.json({ urls });
});

// ── POST /api/batch-monitor/websites ─────────────────────

app.post('/api/batch-monitor/websites', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const err = validateUrl(url);
  if (err) return res.status(400).json({ error: err });

  const existing = readWebsiteFile();
  if (existing.includes(url)) {
    return res.status(409).json({ error: 'URL already exists' });
  }

  existing.push(url);
  writeWebsiteFile(existing);
  res.json({ urls: existing });
});

// ── DELETE /api/batch-monitor/websites ───────────────────

app.delete('/api/batch-monitor/websites', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const existing = readWebsiteFile();
  const index = existing.indexOf(url);
  if (index === -1) {
    return res.status(404).json({ error: 'URL not found in list' });
  }

  existing.splice(index, 1);
  writeWebsiteFile(existing);
  res.json({ urls: existing });
});

// ── POST /api/batch-monitor ──────────────────────────────

app.post('/api/batch-monitor', async (req, res) => {
  const urls = readWebsiteFile();
  if (urls.length === 0) {
    return res.status(400).json({ error: 'No URLs in website.md' });
  }

  const { currentDate } = req.body || {};

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  sseWrite(res, 'batch_start', { total: urls.length });

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    sseWrite(res, 'batch_item_start', { index: i, url });

    const prompt = getPromptForUrl(url, currentDate);
    const messages = [{ role: 'user', content: prompt }];
    const filename = generateReportFilename(url);

    try {
      const content = await runAgenticLoop(
        messages,
        (text) => sseWrite(res, 'batch_item_text', { index: i, url, text }),
        (name, input) =>
          sseWrite(res, 'batch_item_tool_start', { index: i, url, name, input }),
        (name, result, isError) =>
          sseWrite(res, 'batch_item_tool_end', {
            index: i,
            url,
            name,
            result: typeof result === 'string' ? result.slice(0, 500) : result,
            isError,
          })
      );

      writeReport(filename, url, content, 'success');
      sseWrite(res, 'batch_item_done', { index: i, url, filename });
      succeeded++;
    } catch (err) {
      writeReport(filename, url, `Error: ${err.message}`, 'error');
      sseWrite(res, 'batch_item_error', { index: i, url, error: err.message });
      failed++;
    }
  }

  sseWrite(res, 'batch_done', { total: urls.length, succeeded, failed });
  res.end();
});

// ── GET /api/reports ─────────────────────────────────────

app.get('/api/reports', (req, res) => {
  if (!fs.existsSync(REPORTS_DIR)) {
    return res.json({ reports: [] });
  }

  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.md'));
  const reports = files.map((filename) => {
    const filePath = path.join(REPORTS_DIR, filename);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Parse frontmatter
    let url = '';
    const match = content.match(/^---\n[\s\S]*?url:\s*(.+)\n[\s\S]*?---/);
    if (match) url = match[1].trim();

    return {
      filename,
      url,
      timestamp: stat.mtime.toISOString(),
      size: stat.size,
    };
  });

  reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ reports });
});

// ── GET /api/reports/:filename ───────────────────────────

app.get('/api/reports/:filename', (req, res) => {
  const filename = req.params.filename;
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  res.type('text/markdown').send(content);
});

// ── DELETE /api/reports/:filename ─────────────────────────

app.delete('/api/reports/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  fs.unlinkSync(filePath);
  res.json({ deleted: filename });
});

// ── DELETE /api/reports ──────────────────────────────────

app.delete('/api/reports', (req, res) => {
  if (!fs.existsSync(REPORTS_DIR)) {
    return res.json({ deleted: 0 });
  }

  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    fs.unlinkSync(path.join(REPORTS_DIR, file));
  }
  res.json({ deleted: files.length });
});

// ── GET /api/config ──────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json(getProviderInfo());
});

// ── GET /api/health ──────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA fallback ─────────────────────────────────────────

if (fs.existsSync(clientDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Start ────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
