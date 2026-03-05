import { useState, useEffect, useCallback } from 'react';
import WebsiteListEditor from './WebsiteListEditor';
import { authFetch } from '../utils/authFetch';

export default function BatchMonitorPanel({
  onClose,
  batchRunning,
  setBatchRunning,
  currentDate,
  onDateChange,
  batchStatuses,
  setBatchStatuses,
  batchResult,
  setBatchResult,
}) {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/batch-monitor/websites');
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
    setBatchStatuses(initialStatuses);

    try {
      const response = await authFetch('/api/batch-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentDate }),
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
            setBatchStatuses((prev) => ({ ...prev, [data.index]: 'monitoring' }));
          } else if (event === 'batch_item_done') {
            setBatchStatuses((prev) => ({ ...prev, [data.index]: 'done' }));
          } else if (event === 'batch_item_error') {
            setBatchStatuses((prev) => ({ ...prev, [data.index]: 'failed' }));
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

  const completedCount = Object.values(batchStatuses).filter((s) => s === 'done' || s === 'failed').length;
  const totalCount = Object.keys(batchStatuses).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
            <div className="flex items-center gap-2 mb-4 flex-wrap">
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
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  disabled={batchRunning}
                  className="bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 disabled:opacity-50"
                />
              </div>
              {totalCount > 0 && (
                <span className="text-sm text-gray-500 ml-auto">
                  {completedCount} / {totalCount} completed
                </span>
              )}
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      batchResult && !batchResult.error
                        ? 'bg-green-500'
                        : batchRunning
                          ? 'bg-blue-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">{progressPercent}%</div>
              </div>
            )}

            <ul className="space-y-2">
              {urls.map((url, i) => {
                const status = batchStatuses[i];
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
