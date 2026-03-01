import { useState } from 'react';

export default function ToolActivityCard({ tool }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    tool.status === 'running'
      ? 'text-yellow-600 dark:text-yellow-400'
      : tool.status === 'failed'
        ? 'text-red-600 dark:text-red-400'
        : 'text-green-600 dark:text-green-400';

  const statusText =
    tool.status === 'running'
      ? tool.name === 'web_search' ? 'searching...' : 'fetching...'
      : tool.status === 'failed'
        ? 'failed'
        : 'done';

  const displayInput =
    tool.name === 'web_search'
      ? tool.input?.query
      : tool.input?.url;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-xs">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {tool.name === 'web_search' ? 'Web Search' : 'Fetch URL'}
          </span>
          <span className="text-gray-500 dark:text-gray-400 truncate">
            {displayInput && (
              tool.name === 'fetch_url' ? (
                <a
                  href={displayInput}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayInput}
                </a>
              ) : (
                displayInput
              )
            )}
          </span>
        </div>
        <span className={`flex-shrink-0 ml-2 font-medium ${statusColor}`}>
          {statusText}
        </span>
      </button>
      {expanded && tool.result && (
        <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-600 pt-2">
          <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
            {tool.result}
          </pre>
        </div>
      )}
    </div>
  );
}
