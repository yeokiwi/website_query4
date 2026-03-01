import { useState, useEffect, useCallback } from 'react';
import WebsiteListEditor from './WebsiteListEditor';

export default function BatchMonitorPanel({ onClose, batchRunning, setBatchRunning }) {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [batchResult, setBatchResult] = useState(null);

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/batch-monitor/websites');
      const data = await res.json();
      setUrls(data.urls || []);
    } catch {
      setUrls([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  const handleRunAll = async () => {
    if (urls.length === 0) return;
    setBatchRunning(true);
    setBatchResult(null);

    const initialStatuses = {};
    urls.forEach((url, i) => { initialStatuses[i] = 'pending'; });
    setStatuses(initialStatuses);

    try {
      const response = await fetch('/api/batch-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (event === 'batch_item_start') {
            setStatuses((prev) => ({ ...prev, [data.index]: 'monitoring' }));
          } else if (event === 'batch_item_done') {
            setStatuses((prev) => ({ ...prev, [data.index]: 'done' }));
          } else if (event === 'batch_item_error') {
            setStatuses((prev) => ({ ...prev, [data.index]: 'failed' }));
          } else if (event === 'batch_done') {
            setBatchResult(data);
          }
        }
      }
    } catch (err) {
      setBatchResult({ error: err.message });
    }

    setBatchRunning(false);
  };

  const completedCount = Object.values(statuses).filter((s) => s === 'done' || s === 'failed').length;
  const totalCount = Object.keys(statuses).length;

  if (showEditor) {
    return (
      <WebsiteListEditor
        onClose={() => {
          setShowEditor(false);
          fetchUrls();
        }}
        disabled={batchRunning}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Batch Monitor</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : urls.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No URLs configured. Add URLs to <code>website.md</code> to get started.
            </p>
            <button
              onClick={() => setShowEditor(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Add URLs
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={handleRunAll}
                disabled={batchRunning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {batchRunning ? 'Running...' : 'Run All'}
              </button>
              <button
                onClick={() => setShowEditor(true)}
                disabled={batchRunning}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
              >
                Edit List
              </button>
              {totalCount > 0 && (
                <span className="text-sm text-gray-500 ml-auto">
                  {completedCount} / {totalCount} completed
                </span>
              )}
            </div>

            <ul className="space-y-2">
              {urls.map((url, i) => {
                const status = statuses[i];
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-sm truncate mr-2">{url}</span>
                    {status && (
                      <span
                        className={`text-xs font-medium flex-shrink-0 ${
                          status === 'pending'
                            ? 'text-gray-400'
                            : status === 'monitoring'
                              ? 'text-yellow-500'
                              : status === 'done'
                                ? 'text-green-500'
                                : 'text-red-500'
                        }`}
                      >
                        {status === 'monitoring' ? 'monitoring...' : status}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {batchResult && !batchResult.error && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400">
                Batch complete: {batchResult.succeeded} succeeded, {batchResult.failed} failed out of {batchResult.total} total.
              </div>
            )}
            {batchResult?.error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-400">
                Error: {batchResult.error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
