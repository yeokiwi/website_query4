import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ── Provider config ──────────────────────────────────────

const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '4096', 10);
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.7');
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'You are a helpful assistant with the ability to browse the web. When a user asks about current events, recent data, or specific URLs, use the web_search or fetch_url tools to retrieve up-to-date information before answering. Always cite your sources by including the URL in your response.';

// ── Tool definitions (Anthropic format — canonical) ──────

const anthropicTools = [
  {
    name: 'web_search',
    description:
      'Search the web for current information using a query string. Use this when the user asks about recent events, news, prices, or anything that may have changed.',
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

// OpenAI-format tools (for DeepSeek)
const openaiTools = anthropicTools.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

// ── Anthropic provider ───────────────────────────────────

function createAnthropicProvider() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.MODEL_NAME || 'claude-sonnet-4-20250514';

  return {
    name: 'anthropic',
    model,
    async createMessage(messages) {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        tools: anthropicTools,
        messages,
      });
      // Already in the canonical format
      return response;
    },
  };
}

// ── DeepSeek provider ────────────────────────────────────

function createDeepSeekProvider() {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  return {
    name: 'deepseek',
    model,
    async createMessage(messages) {
      // Convert Anthropic-format messages to OpenAI-format
      const openaiMessages = convertMessagesToOpenAI(messages);

      const response = await client.chat.completions.create({
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...openaiMessages],
        tools: openaiTools,
      });

      // Normalize to Anthropic-format response
      return normalizeOpenAIResponse(response);
    },
  };
}

// ── Message format conversion ────────────────────────────

/**
 * Converts Anthropic-format message history to OpenAI-format.
 *
 * Anthropic messages can have:
 *  - { role: 'user', content: 'string' }
 *  - { role: 'user', content: [{ type: 'tool_result', tool_use_id, content, is_error }] }
 *  - { role: 'assistant', content: [{ type: 'text', text }, { type: 'tool_use', id, name, input }] }
 */
function convertMessagesToOpenAI(messages) {
  const result = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Tool results → OpenAI tool messages
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
            });
          }
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'assistant', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Build a single assistant message with text + tool_calls
        let text = '';
        const toolCalls = [];

        for (const block of msg.content) {
          if (block.type === 'text') {
            text += block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          }
        }

        const assistantMsg = { role: 'assistant', content: text || null };
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls;
        }
        result.push(assistantMsg);
      }
    }
  }

  return result;
}

/**
 * Normalizes an OpenAI chat completion response to the Anthropic response format
 * so the agentic loop can handle it uniformly.
 */
function normalizeOpenAIResponse(response) {
  const choice = response.choices[0];
  const message = choice.message;
  const content = [];

  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const tc of message.tool_calls) {
      let args;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: args,
      });
    }
  }

  // Map finish_reason
  let stopReason;
  if (choice.finish_reason === 'tool_calls') {
    stopReason = 'tool_use';
  } else {
    stopReason = 'end_turn';
  }

  return {
    content,
    stop_reason: stopReason,
  };
}

// ── Provider selection ───────────────────────────────────

let provider;
if (LLM_PROVIDER === 'deepseek') {
  provider = createDeepSeekProvider();
} else {
  provider = createAnthropicProvider();
}

console.log(`LLM provider: ${provider.name} (model: ${provider.model})`);

// ── Exports ──────────────────────────────────────────────

export async function createMessage(messages) {
  return provider.createMessage(messages);
}

export function getProviderInfo() {
  return { provider: provider.name, model: provider.model };
}

export { anthropicTools as tools, SYSTEM_PROMPT };
