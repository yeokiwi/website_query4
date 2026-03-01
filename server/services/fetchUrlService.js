import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const FETCH_MAX_CHARS = parseInt(process.env.FETCH_MAX_CHARS || '8000', 10);

const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[::1\]/,
  /^fc/i,
  /^fd/i,
  /^fe80/i,
];

function isBlockedUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname;
    return BLOCKED_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return true;
  }
}

export async function fetchUrl(url, extractMode = 'text') {
  if (isBlockedUrl(url)) {
    throw new Error('URL is blocked: private or non-HTTPS address');
  }

  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; WebsiteChangeMonitor/1.0)',
    },
    maxRedirects: 5,
    responseType: 'text',
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, header, footer, iframe, noscript, svg, form, [role="navigation"], [role="banner"], [role="contentinfo"], .nav, .navbar, .footer, .sidebar, .ad, .ads, .advertisement').remove();

  // Try to get main content
  let content = $('main, article, [role="main"], .content, .post, .entry').first();
  if (!content.length) {
    content = $('body');
  }

  let result;
  if (extractMode === 'markdown') {
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    result = turndown.turndown(content.html() || '');
  } else {
    result = content.text().replace(/\s+/g, ' ').trim();
  }

  // Truncate
  if (result.length > FETCH_MAX_CHARS) {
    result = result.slice(0, FETCH_MAX_CHARS) + '\n\n[Content truncated]';
  }

  return result;
}

export { isBlockedUrl };
