import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_NAME = process.env.MODEL_NAME || 'claude-sonnet-4-20250514';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '4096', 10);
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.7');
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'You are a helpful assistant with the ability to browse the web. When a user asks about current events, recent data, or specific URLs, use the web_search or fetch_url tools to retrieve up-to-date information before answering. Always cite your sources by including the URL in your response.';

const tools = [
  {
    name: 'web_search',
    description:
      "Search the web for current information using a query string. Use this when the user asks about recent events, news, prices, or anything that may have changed.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query string' },
        num_results: {
          type: 'integer',
          description: 'Number of results to return (default: 5, max: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description:
      'Fetch and extract the readable text content of a webpage by URL. Use this to read the full content of a specific page, article, or document.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL of the page to fetch (must include https://)',
        },
        extract_mode: {
          type: 'string',
          enum: ['text', 'markdown'],
          description:
            "How to extract content: 'text' for plain text, 'markdown' for structured markdown",
        },
      },
      required: ['url'],
    },
  },
];

export async function createMessage(messages) {
  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });
  return response;
}

export { tools, SYSTEM_PROMPT };
