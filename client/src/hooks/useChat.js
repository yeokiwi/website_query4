import { useState, useCallback, useRef, useEffect } from 'react';
import { loadMessages, saveMessages, clearMessages } from '../utils/storage';
import { apiFetch } from '../utils/api';

export function useChat() {
  const [messages, setMessages] = useState(() => loadMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState([]);
  const abortRef = useRef(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const sendMessage = useCallback(async (content) => {
    const userMsg = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => {
      const next = [...prev, userMsg];
      // Build API messages (role + content only)
      return next;
    });

    setIsLoading(true);
    setActiveTools([]);

    // We need the updated messages for the API call
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantMsg = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      tools: [],
    };

    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.slice(7);
            const dataLine = lines[lines.indexOf(line) + 1];
            // We'll parse using a different approach
          }
        }

        // Parse SSE events from the chunk
        const events = parseSSEChunk(buffer + lines.join('\n'));
        // Actually, let's reparse properly
      }
    } catch {
      // handled below
    }

    setIsLoading(false);
  }, [messages]);

  // Better SSE handling approach
  const sendMessageSSE = useCallback(async (content) => {
    const userMsg = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);

    setIsLoading(true);
    setActiveTools([]);

    const apiMessages = currentMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantMsgIndex = currentMessages.length;
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        tools: [],
      },
    ]);

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let toolsList = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const eventMatch = part.match(/^event:\s*(.+)$/m);
          const dataMatch = part.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          let data;
          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (event === 'text') {
            accumulatedText += data.text;
            setMessages((prev) => {
              const next = [...prev];
              next[assistantMsgIndex] = {
                ...next[assistantMsgIndex],
                content: accumulatedText,
              };
              return next;
            });
          } else if (event === 'tool_start') {
            const tool = { name: data.name, input: data.input, status: 'running', result: null };
            toolsList = [...toolsList, tool];
            setActiveTools([...toolsList]);
            setMessages((prev) => {
              const next = [...prev];
              next[assistantMsgIndex] = {
                ...next[assistantMsgIndex],
                tools: [...toolsList],
              };
              return next;
            });
          } else if (event === 'tool_end') {
            toolsList = toolsList.map((t, i) =>
              i === toolsList.length - 1
                ? { ...t, status: data.isError ? 'failed' : 'done', result: data.result }
                : t
            );
            setActiveTools([...toolsList]);
            setMessages((prev) => {
              const next = [...prev];
              next[assistantMsgIndex] = {
                ...next[assistantMsgIndex],
                tools: [...toolsList],
              };
              return next;
            });
          } else if (event === 'error') {
            accumulatedText += `\n\nError: ${data.error}`;
            setMessages((prev) => {
              const next = [...prev];
              next[assistantMsgIndex] = {
                ...next[assistantMsgIndex],
                content: accumulatedText,
              };
              return next;
            });
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[assistantMsgIndex] = {
          ...next[assistantMsgIndex],
          content: `Error: ${err.message}`,
        };
        return next;
      });
    }

    setIsLoading(false);
    setActiveTools([]);
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    clearMessages();
    setActiveTools([]);
  }, []);

  return {
    messages,
    isLoading,
    activeTools,
    sendMessage: sendMessageSSE,
    clearChat,
  };
}
